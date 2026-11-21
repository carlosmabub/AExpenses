# AExpenses

Prestação de contas dos cartões corporativos. O app recebe as compras do arquivo de cartões do Bradesco
(layout **BVK3**), pede ao funcionário que classifique cada compra e mostra ao financeiro o que foi
classificado e o que foi ignorado. No fim, exporta um Excel para carga no ERP.

- **Funcionário (celular)**: `/app`, web app instalável (PWA). Vê as compras que chegaram, escolhe a categoria
  (já sugerida pelo ramo do estabelecimento), descreve e fotografa o comprovante.
- **Financeiro (desktop)**: `/admin`, com dashboard, importação do arquivo, despesas com filtros, funcionários e
  cartões, categorias e exportação Excel.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # leitor BVK3 e regras de importação/classificação
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

1. Entre como **Financeiro** → *Importar arquivo* → envie o arquivo de exemplo.
2. No modo simulado, cada compra chega ao app no dia seguinte ao lançamento (D+1, 08:00). Use o
   **relógio do piloto** (+1d, +2d, +7d) para avançar os dias.
3. Entre como um funcionário (ex.: **Diego Rocha**) num celular ou janela estreita e classifique as compras.
4. O que não for classificado em 48h vira **ignorada** e aparece no dashboard do financeiro.
5. *Exportar Excel* gera a planilha da prestação de contas.

Com o arquivo diário real, mude para **modo real** em *Importar arquivo*: as compras chegam no momento da importação.

## Regras principais

- **Conferência**: cada arquivo é conferido com o trailer (quantidade e total) e com o total de cada cartão.
  Arquivo divergente não é importado, a menos que o admin force.
- **Dados sensíveis**: o número completo do cartão e o CPF nunca são gravados. O cartão é identificado por uma
  impressão digital HMAC (`AEX_CARD_SECRET`) e pelos 4 últimos dígitos.
- **Vínculo cartão ↔ funcionário**: pelo "nome no cartão" do cadastro do funcionário. Cartões sem dono ficam
  na fila de não vinculados.
- **Lançamentos**: saldo anterior, pagamento e ajustes são ignorados. Saques entram e pedem justificativa.
  Estornos aparecem sem pedir classificação. Os códigos foram deduzidos do exemplo e a tabela oficial deve ser
  pedida ao banco (`src/lib/bvk3/codes.ts`).
- **Duplicidade**: reimportar o mesmo arquivo não duplica (referência Visa + parcela).
- **Parcelas**: a parcela de uma compra já classificada herda a classificação.

## Estrutura

```
src/lib/bvk3/       leitor do layout BVK3, tipos de lançamento e importação
src/lib/            prazo/relógio, sugestão por MCC, classificação, exportação Excel, autenticação
src/db/             schema (Drizzle + SQLite) e seed
src/app/app/        telas do funcionário (mobile)
src/app/admin/      telas do financeiro (desktop)
drizzle/            migrações SQL
tests/              testes com o arquivo de exemplo do banco
```

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `AEX_SESSION_SECRET` | assina o cookie de sessão (obrigatório em produção) |
| `AEX_CARD_SECRET` | segredo da impressão digital dos cartões (obrigatório em produção, não trocar depois) |
| `AEX_DATA_DIR` | pasta do banco e dos comprovantes (padrão `./data`) |
| `AEX_DEMO` | `0` desliga o login rápido de demonstração |
