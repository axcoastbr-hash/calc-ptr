# Calculadora de Reserva Matemática Individual (VAEBA) — PPSP-NR

Aplicação estática (HTML/CSS/JS) para apurar a VAEBA individual do plano PPSP-NR (Não Repactuados), operando 100% offline com äx(12) pela Tábua PETROS AT Ordinária (qx unissex, comutação + Woolhouse) e série INPC embutida.

## Executando localmente
1. Clone ou baixe este repositório.
2. Abra `index.html` diretamente no navegador (ou sirva com `python -m http.server`).
3. Preencha os dados do participante, datas e valores; clique em **Calcular**.

## Funcionalidades principais
- Cálculo automático do fator atuarial subanual äx(12) pela Tábua PETROS AT Ordinária (qx unissex, ω=115, fechamento técnico), com comutação + Woolhouse e interpolação pela idade exata.
- FATCOR via INPC embutido (1994-01 a 2025-11) com possibilidade de upload CSV/JSON para substituição.
- Apresentação de VAEBA BRUTA e VAEBA AJUSTADA, fator K e auditoria detalhada.
- Geração de Parecer Técnico Resumido no estilo “Mara” + botões de copiar auditoria/parecer.
- Validação de divergência do benefício líquido informado e reset rápido dos campos.

**Mortalidade/äx(12):** PETROS AT Ordinária (qx unissex), comutação + Woolhouse (−11/24), ω=115, fechamento técnico em 115.

## Exemplo preenchido
- Nome: João de Souza
- Sexo: Masculino
- Data de nascimento: 1960-05-10
- Data do cálculo: data atual
- Competência base: 01/2024
- Benefício bruto: R$ 8.500,00
- Rubricas: todas R$ 0,00 (para teste rápido)

Resultado esperado (aproximação, pois depende da data exata do dia):
- äx(12)≈9,40 (idade ~64)
- FATCOR(2024-01→2025-11)≈1,08008
- VAEBA BRUTA ≈ R$ 103.000,00

Repita o exemplo para verificar se a interface está operando corretamente.

## Como validar a correção (tábua unissex)
1. Abra `index.html` e use os mesmos dados para os dois cálculos, mudando apenas o sexo (ex.: nome qualquer, nascimento 1966-05-04, competência base 2024-06, data do cálculo 2024-06-30).
2. Observe a tabela “Diagnóstico äx(12)” no painel lateral: os valores para masculino e feminino devem ser iguais nas idades 50, 60, 67 e 80 (tábua unissex PETROS AT Ordinária).
3. Compare os resultados: VAEBA masculina e feminina devem ser iguais para os mesmos inputs.
