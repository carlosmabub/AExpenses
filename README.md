# AExpenses

Prestação de contas dos cartões corporativos. O app recebe as compras do arquivo de cartões do Bradesco
(layout **BVK3**), pede ao funcionário que classifique cada compra e mostra ao financeiro o que foi
preenchido, aprovado e ignorado. No fim, exporta um Excel para carga no ERP.

- **Funcionário (celular)**: `/app`, web app instalável (PWA). Vê as compras que chegaram, escolhe a categoria
  (já sugerida pelo ramo do estabelecimento), descreve e fotografa o comprovante.
- **Financeiro (desktop)**: `/admin`, com dashboard, importação do arquivo, despesas com filtros, funcionários e
  cartões, categorias e exportação Excel.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # leitor BVK3, importação, relatórios e aprovação
npm run build      # build de produção
npm run db:reset   # apaga o banco local (data/) e recomeça do seed
```

Na primeira execução o banco SQLite é criado em `data/` com um admin e funcionários de demonstração
(a tela de login tem atalhos "entrar como"; desligue com `AEX_DEMO=0`).

| Usuário | E-mail | Senha |
|---|---|---|
| Financeiro (admin) | financeiro@empresa.com.br | admin123 |
| Funcionários | nome.sobrenome@empresa.com.br | 123456 |

## Piloto: simulando o arquivo diário

O banco ainda vai confirmar se o arquivo BVK3 sai diariamente. Para demonstrar o fluxo com o exemplo mensal
(`tests/fixtures/BVK3EXEMPLOMENSAL.txt`):

1. Entre como **Financeiro** → *Importar arquivo* → envie o arquivo de exemplo. Com a caixa "Piloto: considerar
   todos os gastos do arquivo como do cartão do Carlos" marcada (padrão no modo simulado), todas as compras do arquivo
   viram do cartão do usuário **Carlos** (carlos@empresa.com.br, senha 123456). Desmarque para ver os gastos divididos
   entre os portadores fictícios.
   A caixa "Piloto: trazer as datas do arquivo para o mês atual" (também marcada por padrão) anda com todas as datas
   do exemplo, que é de 2013, em semanas inteiras até perto de hoje, mantendo os intervalos e os dias da semana.
2. No modo simulado, cada compra chega ao app no dia seguinte ao lançamento (D+1, 08:00). Use o
   **relógio do piloto** (+1d, +2d, +7d) para avançar os dias.
3. Entre como **Carlos** num celular ou janela estreita, crie um relatório pelo + e lance nele as compras.
4. O que não entrar num relatório enviado até o fim do mês vira **ignorada** e aparece no dashboard do financeiro.
5. *Exportar Excel* gera a planilha da prestação de contas.

Com o arquivo diário real, mude para **modo real** em *Importar arquivo*: as compras chegam no momento da importação.

## Fluxo (inspirado no VExpenses)

1. As compras do cartão chegam sozinhas pelo arquivo do banco e ficam em **despesas sem relatório**.
   Despesas fora do cartão (dinheiro ou adiantamento) são lançadas pelo botão **+**.
2. O funcionário preenche cada despesa: tipo, descrição, centro de custo (vem do cadastro, pode mudar por despesa)
   e **comprovante**, obrigatório pela política de cada tipo de despesa.
3. Cria um **relatório** (nome, centro de custo, adiantamentos, observações), coloca as despesas nele e envia para aprovação.
4. O aprovador (por enquanto o financeiro, depois o líder de cada equipe) **aprova ou devolve cada despesa**, com comentário.
   A devolvida volta para o funcionário corrigir e retorna ao aprovador; o relatório fica aprovado quando todas forem aprovadas.
5. **Adiantamentos** são registrados pelo financeiro; o relatório mostra quanto foi gasto e o saldo a devolver.
6. **Prazo**: a despesa precisa estar num relatório enviado até o fim do mês da compra (23:59 de Brasília), com no mínimo
   5 dias desde a chegada. Depois disso ela aparece como ignorada para o financeiro.
7. O Excel sai com tudo: relatório, status e a aprovação de cada despesa.

## Regras principais

- **Conferência**: cada arquivo é conferido com o trailer (quantidade e total) e com o total de cada cartão.
  Arquivo divergente não é importado, a menos que o admin force.
- **Dados sensíveis**: o número completo do cartão e o CPF nunca são gravados. O cartão é identificado por uma
  impressão digital HMAC (`AEX_CARD_SECRET`) e pelos 4 últimos dígitos.
- **Vínculo cartão ↔ funcionário**: pelo "nome no cartão" do cadastro do funcionário. Cartões sem dono ficam
  na fila de não vinculados.
- **Lançamentos**: saldo anterior, pagamento e ajustes são ignorados. Saques entram e pedem preenchimento.
  Estornos aparecem sem pedir preenchimento. Os códigos foram deduzidos do exemplo e a tabela oficial deve ser
  pedida ao banco (`src/lib/bvk3/codes.ts`).
- **Duplicidade**: reimportar o mesmo arquivo não duplica (referência Visa + parcela).
- **Parcelas**: a parcela nova de uma compra já preenchida herda o preenchimento.

## Estrutura

```
src/lib/bvk3/       leitor do layout BVK3, tipos de lançamento e importação
src/lib/            prazo/relógio, sugestão por MCC, despesas, relatórios e adiantamentos, exportação Excel, autenticação
src/db/             schema (Drizzle + SQLite/Turso) e seed
src/app/app/        telas do funcionário (mobile)
src/app/admin/      telas do financeiro (desktop)
drizzle/            migrações SQL
tests/              testes com o arquivo de exemplo do banco
```

## Publicar na Vercel (ambiente de teste)

Na Vercel não há disco permanente, então o app usa dois serviços externos, ambos com plano gratuito:
**Turso** (o banco SQLite na nuvem) e **Vercel Blob** (as fotos dos comprovantes, em modo privado).
Localmente nada disso é necessário: sem essas variáveis o app usa `data/` como antes.

1. **Banco (Turso)**
   1. Crie uma conta em [turso.tech](https://turso.tech) e crie um banco (ex.: `aexpenses`, região São Paulo se houver).
   2. Copie a **URL** do banco (começa com `libsql://`) e gere um **token** (*Create Token*). Guarde os dois.
2. **Projeto na Vercel**
   1. Em [vercel.com](https://vercel.com) → *Add New… → Project* → importe o repositório `carlosmabub/AExpenses`.
   2. Em *Environment Variables*, adicione:

      | Variável | Valor |
      |---|---|
      | `TURSO_DATABASE_URL` | URL do passo 1 (`libsql://...`) |
      | `TURSO_AUTH_TOKEN` | token do passo 1 |
      | `AEX_SESSION_SECRET` | um texto aleatório longo (gere com `openssl rand -hex 32` ou um gerador de senhas) |
      | `AEX_CARD_SECRET` | outro texto aleatório longo. **Não troque depois**: ele identifica os cartões entre importações |

   3. Clique em *Deploy*. O primeiro deploy usa a branch padrão do repositório; para publicar esta branch antes do
      merge, em *Settings → Git* escolha `claude/stoic-euler-bxe6yo` como *Production Branch* (ou abra o deploy de
      *Preview* que a Vercel cria para ela).
3. **Comprovantes (Vercel Blob)**
   1. No projeto, aba *Storage* → *Create* → **Blob** → acesso **Private** → conecte ao projeto.
      Isso cria a variável `BLOB_READ_WRITE_TOKEN` sozinho.
   2. Faça *Redeploy* para o app enxergar a variável nova.
4. **Primeiro acesso**: abra o endereço do projeto, entre como **Financeiro** e importe
   `tests/fixtures/BVK3EXEMPLOMENSAL.txt`. As tabelas e os usuários de demonstração são criados sozinhos no primeiro acesso.

A cada `git push` a Vercel publica a versão nova.

Se a base da Vercel já tiver o arquivo importado do jeito antigo (um cartão por portador), use *Importar arquivo →
Apagar dados do piloto* e importe de novo com as caixas do piloto marcadas (apagar também zera o relógio).

> **Atenção**: este ambiente é de teste, com login rápido de demonstração ligado e senhas conhecidas. Antes de usar
> com dados reais, defina `AEX_DEMO=0`, troque as senhas e não use o arquivo real do banco num ambiente público.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | banco na nuvem (obrigatório na Vercel). Sem elas, usa `data/aexpenses.db` |
| `BLOB_READ_WRITE_TOKEN` | comprovantes no Vercel Blob (criado ao conectar o Blob). Sem ele, usa `data/receipts` |
| `AEX_SESSION_SECRET` | assina o cookie de sessão (obrigatório na Vercel) |
| `AEX_CARD_SECRET` | segredo da impressão digital dos cartões (obrigatório na Vercel, não trocar depois) |
| `AEX_DATA_DIR` | pasta local do banco e dos comprovantes (padrão `./data`) |
| `AEX_DEMO` | `0` desliga o login rápido de demonstração |
