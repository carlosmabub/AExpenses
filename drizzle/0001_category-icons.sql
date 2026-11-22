-- Ícones das categorias deixam de ser emoji e passam a ser nomes de ícones (src/components/category-icon.tsx)
UPDATE `categories` SET `icon` = CASE `icon`
  WHEN '🍽️' THEN 'utensils'
  WHEN '🏨' THEN 'bed'
  WHEN '⛽' THEN 'fuel'
  WHEN '🚕' THEN 'car'
  WHEN '🅿️' THEN 'parking'
  WHEN '✈️' THEN 'plane'
  WHEN '📎' THEN 'paperclip'
  WHEN '🏧' THEN 'banknote'
  ELSE 'receipt'
END
WHERE `icon` NOT IN ('utensils', 'bed', 'fuel', 'car', 'parking', 'plane', 'paperclip', 'banknote', 'receipt');
