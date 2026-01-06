# Calculadora de Reserva Matemática Individual (VAEBA) — PPSP-NR

Aplicação estática (HTML/CSS/JS) para apurar a VAEBA individual do plano PPSP-NR (Não Repactuados), operando 100% offline com Tábua AT-2000 Suavizada (qx) por sexo e série INPC embutida.

## Executando localmente
1. Clone ou baixe este repositório.
2. Abra `index.html` diretamente no navegador (ou sirva com `python -m http.server`).
3. Preencha os dados do participante, datas e valores; clique em **Calcular**.

## Funcionalidades principais
- Cálculo automático do fator atuarial subanual äx(12) pela Tábua AT-2000 Suavizada (qx) por sexo, via comutação + Woolhouse, interpolado pela idade exata.
- FATCOR via INPC embutido (1994-01 a 2025-11) com possibilidade de upload CSV/JSON para substituição.
- Apresentação de VAEBA BRUTA e VAEBA AJUSTADA, fator K e auditoria detalhada.
- Geração de Parecer Técnico Resumido no estilo “Mara” + botões de copiar auditoria/parecer.
- Validação de divergência do benefício líquido informado e reset rápido dos campos.

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

## Validação rápida (äx(12) por sexo)
Para uma idade fixa (ex.: 58), a tábua AT-2000 Suavizada deve indicar äx(12) feminino maior que o masculino na maioria das idades adultas.
