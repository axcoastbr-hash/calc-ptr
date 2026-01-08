const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numberFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 10 });

let inpcIndex = { ...INPC_INDEX };

const inputNome = document.getElementById("nome");
const inputSexo = document.getElementById("sexo");
const inputNascimento = document.getElementById("dataNascimento");
const inputCalculo = document.getElementById("dataCalculo");
const inputCompetencia = document.getElementById("competenciaBase");
const inputBeneficioBruto = document.getElementById("beneficioBruto");
const inputBeneficioLiquido = document.getElementById("beneficioLiquido");
const rubricaInputs = Array.from(document.querySelectorAll(".rubrica"));
const uploadInput = document.getElementById("inpcUpload");
const uploadStatus = document.getElementById("uploadStatus");

const btnCalcular = document.getElementById("calcular");
const btnLimpar = document.getElementById("limpar");
const btnCopiarAuditoria = document.getElementById("copiarAuditoria");
const btnCopiarParecer = document.getElementById("copiarParecer");
const btnBaixarParecer = document.getElementById("baixarParecer");
const inputAnexarAuditoria = document.getElementById("anexarAuditoria");

const outBruta = document.getElementById("vaebaBruta");
const outAjustada = document.getElementById("vaebaAjustada");
const outK = document.getElementById("fatorK");
const outAlerts = document.getElementById("alerts");
const auditoriaBox = document.getElementById("auditoria");
const parecerBox = document.getElementById("parecer");

let ax12Tables = { masc: [], fem: [] };

function initDefaults() {
  const today = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  inputCalculo.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

initDefaults();
buildAx12Tables();
debugAx12Sanity();

function toMoney(value) {
  if (!isFinite(value)) return "—";
  return currencyFormatter.format(value);
}

function toNumber(value) {
  if (typeof value !== "string") return Number.NaN;
  const cleaned = value.replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const num = Number(cleaned);
  return isNaN(num) ? Number.NaN : num;
}

function normalizeCompetencia(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const dashMatch = trimmed.match(/^(\d{4})[-/](\d{2})$/);
  const slashMatch = trimmed.match(/^(\d{2})[-/](\d{4})$/);
  if (dashMatch) {
    return `${dashMatch[1]}-${dashMatch[2]}`;
  }
  if (slashMatch) {
    return `${slashMatch[2]}-${slashMatch[1]}`;
  }
  return null;
}

function dateToCompetencia(dateStr) {
  const dt = new Date(dateStr);
  if (isNaN(dt)) return null;
  const pad = (n) => n.toString().padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}

function computeAgeExact(birthStr, calcStr) {
  const birth = new Date(birthStr);
  const calc = new Date(calcStr);
  if (isNaN(birth) || isNaN(calc)) throw new Error("Datas inválidas");
  if (calc < birth) throw new Error("Data do cálculo anterior à data de nascimento.");
  const diffMs = calc - birth;
  const ageYears = diffMs / (1000 * 60 * 60 * 24 * 365.2425);
  return ageYears;
}

function buildAx12Table(qx) {
  if (qx.length - 1 < OMEGA) throw new Error("Tábua biométrica incompleta para o omega definido.");
  const qxLocal = [...qx];
  qxLocal[OMEGA] = 1.0;
  const l = new Array(OMEGA + 1).fill(0);
  l[0] = 10_000_000;
  for (let x = 1; x <= OMEGA; x++) {
    l[x] = l[x - 1] * (1 - qxLocal[x - 1]);
  }
  const v = 1 / (1 + INTEREST_I);
  const D = l.map((lx, x) => lx * Math.pow(v, x));
  const N = new Array(OMEGA + 1).fill(0);
  N[OMEGA] = D[OMEGA];
  for (let x = OMEGA - 1; x >= 0; x--) {
    N[x] = N[x + 1] + D[x];
  }
  return D.map((Dx, x) => {
    if (Dx === 0) throw new Error("D[x] = 0 na comutação. Verifique qx/omega.");
    return N[x] / Dx - 11 / 24;
  });
}

function buildAx12Tables() {
  ax12Tables = {
    masc: buildAx12Table(qx_at2000_suav_masc),
    fem: buildAx12Table(qx_at2000_suav_fem),
  };
}

function debugAx12Sanity() {
  const age = 58;
  const axFem = ax12Tables.fem[age];
  const axMasc = ax12Tables.masc[age];
  if (axFem <= axMasc) {
    console.warn("Sanidade AT-2000 Suavizada: feminino <= masculino na idade", age);
    console.warn("tábua fem qx[0..4]", qx_at2000_suav_fem.slice(0, 5));
    console.warn("tábua masc qx[0..4]", qx_at2000_suav_masc.slice(0, 5));
    console.warn("ax12_int fem", axFem, "ax12_int masc", axMasc);
  }
}

function getAx12(sexo, idadeExata) {
  if (idadeExata < 0) throw new Error("Idade negativa não é permitida.");
  if (idadeExata >= OMEGA) throw new Error("Idade fora do limite da tábua AT-2000 Suavizada (ω=115).");
  const table = sexo === "fem" ? ax12Tables.fem : ax12Tables.masc;
  let x0 = Math.floor(idadeExata);
  let f = idadeExata - x0;
  const x1 = x0 + 1;
  const ax0 = table[Math.min(x0, table.length - 1)];
  const ax1 = table[Math.min(x1, table.length - 1)];
  const interp = ax0 + f * (ax1 - ax0);
  return { x0, x1, f, ax0, ax1, ax12: interp };
}

function computeFatcor(baseComp, finalComp) {
  if (!inpcIndex[baseComp]) throw new Error("Competência fora do intervalo do INPC embutido.");
  if (!inpcIndex[finalComp]) throw new Error("Competência final fora do intervalo do INPC embutido.");
  if (finalComp < baseComp) throw new Error("Data do cálculo deve ser posterior ou igual à competência base.");
  const idxBase = inpcIndex[baseComp];
  const idxFinal = inpcIndex[finalComp];
  const fatcor = idxFinal / idxBase;
  return { fatcor, idxBase, idxFinal };
}

function somaRubricas() {
  return rubricaInputs.reduce((acc, input) => {
    const val = toNumber(input.value || "0");
    return acc + (isNaN(val) ? 0 : val);
  }, 0);
}

function clearAlerts() {
  outAlerts.innerHTML = "";
}

function pushAlert(msg, type = "warn") {
  const div = document.createElement("div");
  div.className = `alert ${type === "error" ? "error" : ""}`;
  div.textContent = msg;
  outAlerts.appendChild(div);
}

function fillAuditoria(data) {
  const lines = [];
  lines.push("=== Entradas do Participante ===");
  lines.push(`Nome: ${data.nome || "(não informado)"}`);
  lines.push(`Sexo: ${data.sexo === "fem" ? "Feminino" : "Masculino"}`);
  lines.push(`Data de nascimento: ${data.dn}`);
  lines.push(`Data do cálculo: ${data.dc}`);
  lines.push(`Idade exata: ${data.idadeExata.toFixed(4)} anos (x0=${data.ax.x0}, f=${data.ax.f.toFixed(4)})`);
  lines.push(`Competência base: ${data.competenciaBase}`);
  lines.push("=== Benefício e Rubricas ===");
  lines.push(`Benefício bruto: ${toMoney(data.beneficioBruto)}`);
  lines.push(`Rubricas: CONT. PETROS=${toMoney(data.rubricas.contPetros)}, PARC. DÉBITO PED PPSP=${toMoney(data.rubricas.parcDebito)}, CONT. EXTRAORD. PPSP=${toMoney(data.rubricas.extraPPSP)}, CONT. EXTRAORD. PPSP NR=${toMoney(data.rubricas.extraPPSPNR)}, PECÚLIO=${toMoney(data.rubricas.peculio)}`);
  lines.push(`Total rubricas: ${toMoney(data.totalRubricas)}`);
  lines.push(`SUP ajustado: ${toMoney(data.supAjustado)}`);
  if (data.beneficioLiquidoInformado !== null) {
    lines.push(`Benefício líquido informado: ${toMoney(data.beneficioLiquidoInformado)}`);
    lines.push(`Benefício líquido estimado: ${toMoney(data.beneficioLiquidoEstimado)} (diferença ${toMoney(data.divergenciaLiquido)})`);
  }
  lines.push("=== Premissas Fixas ===");
  lines.push("NSUA = 13; FCB = 0,9818; i = 4,44% a.a.; crescimento real = 0%; äx(12) calculado pela Tábua AT-2000 Suavizada (qx) por sexo, idades 0–115, via comutação e Woolhouse; FATCOR via INPC embutido");
  lines.push("=== Cálculo do INPC (FATCOR) ===");
  lines.push(`Competência final: ${data.competenciaFinal}`);
  lines.push(`Índice base: ${data.inpc.idxBase.toFixed(6)} | Índice final: ${data.inpc.idxFinal.toFixed(6)}`);
  lines.push(`FATCOR = ${numberFormatter.format(data.inpc.fatcor)}`);
  lines.push("=== Cálculo do äx(12) ===");
  lines.push(`Sexo: ${data.sexo === "fem" ? "Feminino" : "Masculino"} | x0=${data.ax.x0}, x1=${data.ax.x1}, f=${data.ax.f.toFixed(4)}`);
  lines.push(`ax12_int[x0]=${numberFormatter.format(data.ax.ax0)}, ax12_int[x1]=${numberFormatter.format(data.ax.ax1)}, interpolado=${numberFormatter.format(data.ax.ax12)}`);
  lines.push("=== Fórmula e Resultados ===");
  lines.push(`K = NSUA × äx(12) × FCB × FATCOR = ${numberFormatter.format(data.k)}`);
  lines.push(`VAEBA BRUTA = ${toMoney(data.vaebaBruta)}`);
  lines.push(`VAEBA AJUSTADA = ${toMoney(data.vaebaAjustada)}`);
  auditoriaBox.value = lines.join("\n");
}

function buildParecer(data, alertas) {
  const bullet = (label, value) => `${label}: ${value}`;
  const linhas = [];
  linhas.push("PARECER TÉCNICO RESUMIDO — CÁLCULO DE RESERVA MATEMÁTICA INDIVIDUAL (VAEBA) — PPSP-NR");
  linhas.push("");
  linhas.push("1. OBJETIVO");
  linhas.push("Apurar a reserva matemática individual (VAEBA) do participante no PPSP-NR com base nos dados informados e nas premissas atuariais fixas do plano.");
  linhas.push("");
  linhas.push("2. METODOLOGIA E PREMISSAS");
  linhas.push("- NSUA = 13 suplementações anuais; FCB = 0,9818; taxa real i = 4,44% a.a.; crescimento real do benefício = 0%.");
  linhas.push("- äx(12) calculado pela Tábua AT-2000 Suavizada (qx), por sexo, idades 0–115, via comutação (D/N) e ajuste de Woolhouse (−11/24), com interpolação pela idade exata.");
  linhas.push("- Correção monetária: INPC embutido; FATCOR = índice(final)/índice(base).");
  linhas.push("- Fator atuarial äx(12) obtido por comutação (l0=10.000.000, v=1/(1+i), Dx, Nx) e interpolação linear pela idade exata.");
  linhas.push("- Fórmula: VAEBA = NSUA × SUP × äx(12) × FCB × FATCOR.");
  linhas.push("");
  linhas.push("3. DADOS DE ENTRADA");
  linhas.push(`- Identificação: ${data.nome || "(não informado)"}, sexo ${data.sexo === "fem" ? "feminino" : "masculino"}, DN ${data.dn}, idade exata ${data.idadeExata.toFixed(4)} anos na data do cálculo.`);
  linhas.push(`- Data do cálculo: ${data.dc}; competência base: ${data.competenciaBase}.`);
  linhas.push(`- Benefício bruto informado: ${toMoney(data.beneficioBruto)}.`);
  linhas.push(`- Rubricas: CONT. PETROS ${toMoney(data.rubricas.contPetros)}; PARC. DÉBITO PED PPSP ${toMoney(data.rubricas.parcDebito)}; CONT. EXTRAORD. PPSP ${toMoney(data.rubricas.extraPPSP)}; CONT. EXTRAORD. PPSP NR ${toMoney(data.rubricas.extraPPSPNR)}; PECÚLIO ${toMoney(data.rubricas.peculio)}. Total = ${toMoney(data.totalRubricas)}.`);
  linhas.push(`- SUP ajustado = ${toMoney(data.supAjustado)}.`);
  if (data.beneficioLiquidoInformado !== null) {
    const divergenciaMsg = Math.abs(data.divergenciaLiquido) > 1 ? ` (divergência ${toMoney(data.divergenciaLiquido)})` : "";
    linhas.push(`- Benefício líquido informado: ${toMoney(data.beneficioLiquidoInformado)}${divergenciaMsg}.`);
  }
  linhas.push("");
  linhas.push("4. APURAÇÃO DOS FATORES");
  linhas.push(`- äx(12) interpolado: ${numberFormatter.format(data.ax.ax12)} (x0=${data.ax.x0}, f=${data.ax.f.toFixed(4)}).`);
  linhas.push(`- INPC: base ${data.competenciaBase} (índice ${data.inpc.idxBase.toFixed(6)}); final ${data.competenciaFinal} (índice ${data.inpc.idxFinal.toFixed(6)}); FATCOR = ${numberFormatter.format(data.inpc.fatcor)}.`);
  linhas.push(`- Fator K = NSUA × äx(12) × FCB × FATCOR = ${numberFormatter.format(data.k)}.`);
  linhas.push("");
  linhas.push("5. RESULTADOS");
  linhas.push(`- VAEBA BRUTA: ${toMoney(data.vaebaBruta)}.`);
  linhas.push(`- VAEBA AJUSTADA: ${toMoney(data.vaebaAjustada)}.`);
  if (alertas.length) {
    alertas.forEach((a) => linhas.push(`- Alerta: ${a}`));
  }
  linhas.push("");
  linhas.push("6. CONSIDERAÇÕES FINAIS");
  linhas.push("Cálculo estimativo offline com base na Tábua AT-2000 Suavizada (qx por sexo, ω=115) e série INPC embutida (1994-01 a 2025-11), considerando premissas atuariais fixas do PPSP-NR.");
  linhas.push("Fatores e valores reproduzíveis mediante repetição das mesmas entradas. Recomenda-se auditoria complementar caso novos dados sejam apresentados.");
  parecerBox.value = linhas.join("\n");
}

function compute() {
  clearAlerts();
  const alertas = [];
  try {
    const nome = inputNome.value.trim();
    const sexo = inputSexo.value;
    const dn = inputNascimento.value;
    const dc = inputCalculo.value;
    const competenciaBaseRaw = inputCompetencia.value;
    const competenciaBase = normalizeCompetencia(competenciaBaseRaw);
    const competenciaFinal = dateToCompetencia(dc);
    const beneficioBruto = toNumber(inputBeneficioBruto.value);
    const beneficioLiquidoInformado = inputBeneficioLiquido.value.trim() ? toNumber(inputBeneficioLiquido.value) : null;

    if (!dn || !dc || !competenciaBase) throw new Error("Preencha data de nascimento, data do cálculo e competência base.");
    if (isNaN(beneficioBruto)) throw new Error("Benefício bruto inválido.");

    const idadeExata = computeAgeExact(dn, dc);
    const ax = getAx12(sexo, idadeExata);

    const inpc = computeFatcor(competenciaBase, competenciaFinal);
    const fatcor = inpc.fatcor;

    const rubricas = rubricaInputs.reduce((acc, input) => {
      const key = input.dataset.key;
      const val = toNumber(input.value || "0");
      acc[key] = isNaN(val) ? 0 : val;
      return acc;
    }, {});
    const totalRubricas = somaRubricas();
    const supAjustado = beneficioBruto - totalRubricas;

    let divergenciaLiquido = 0;
    if (beneficioLiquidoInformado !== null) {
      const estimado = beneficioBruto - totalRubricas;
      divergenciaLiquido = beneficioLiquidoInformado - estimado;
      if (Math.abs(divergenciaLiquido) > 1) {
        const msg = `Divergência entre líquido informado e estimado: ${toMoney(divergenciaLiquido)}.`;
        pushAlert(msg, "warn");
        alertas.push(msg);
      }
    }

    const ax12 = ax.ax12;
    const k = NSUA * ax12 * FCB * fatcor;
    const vaebaBruta = NSUA * beneficioBruto * ax12 * FCB * fatcor;
    const vaebaAjustada = NSUA * supAjustado * ax12 * FCB * fatcor;

    outBruta.textContent = toMoney(vaebaBruta);
    outAjustada.textContent = toMoney(vaebaAjustada);
    outK.textContent = numberFormatter.format(k);

    const data = {
      nome,
      sexo,
      dn,
      dc,
      competenciaBase,
      competenciaFinal,
      beneficioBruto,
      beneficioLiquidoInformado,
      beneficioLiquidoEstimado: beneficioBruto - totalRubricas,
      divergenciaLiquido,
      rubricas,
      totalRubricas,
      supAjustado,
      inpc,
      idadeExata,
      ax,
      k,
      vaebaBruta,
      vaebaAjustada,
    };

    fillAuditoria(data);
    buildParecer(data, alertas);
  } catch (err) {
    pushAlert(err.message, "error");
    outBruta.textContent = outAjustada.textContent = outK.textContent = "—";
    auditoriaBox.value = "";
    parecerBox.value = "";
  }
}

function limpar() {
  inputNome.value = "";
  inputSexo.value = "masc";
  inputNascimento.value = "";
  inputCompetencia.value = "";
  inputBeneficioBruto.value = "";
  inputBeneficioLiquido.value = "";
  rubricaInputs.forEach((r) => (r.value = ""));
  initDefaults();
  outBruta.textContent = outAjustada.textContent = outK.textContent = "—";
  auditoriaBox.value = "";
  parecerBox.value = "";
  clearAlerts();
}

async function copiar(target, label) {
  if (!target.value) return;
  await navigator.clipboard.writeText(target.value);
  const prev = label.textContent;
  label.textContent = "Copiado!";
  setTimeout(() => (label.textContent = prev), 1200);
}

const PDF_PAGE = { width: 595.28, height: 841.89 };
const PDF_SCALE = 2;
const PDF_MARGINS = { top: 140, bottom: 90, left: 60, right: 60 };

function sanitizeFilename(value) {
  return value.replace(/[^\w\d-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "participante";
}

function formatDateForFilename(date = new Date()) {
  const pad = (n) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function loadTimbradoImage() {
  const response = await fetch("/assets/timbrado.png", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Timbrado não encontrado: envie /assets/timbrado.png");
  }
  const blob = await response.blob();
  if ("createImageBitmap" in window) {
    return await createImageBitmap(blob);
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function wrapParagraph(text, style, maxWidth, indent, measureText) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const testLine = current ? `${current} ${word}` : word;
    const width = measureText(testLine, style);
    if (width > maxWidth - indent && current) {
      lines.push(current);
      current = word;
    } else {
      current = testLine;
    }
  });
  if (current) lines.push(current);
  return lines.map((line) => ({ text: line, ...style, indent }));
}

function buildLines(parecerText, auditoriaText, includeAuditoria, measureText, maxWidth, bulletIndent) {
  const lines = [];
  const sections = [parecerText];
  if (includeAuditoria && auditoriaText) {
    sections.push("", "ANEXO — AUDITORIA DO CÁLCULO", "", auditoriaText);
  }

  const titleStyle = { size: 14, weight: 700, lineHeight: 20 };
  const headingStyle = { size: 13, weight: 700, lineHeight: 18 };
  const bodyStyle = { size: 12, weight: 400, lineHeight: 17 };
  let isFirstLine = true;

  sections.join("\n").split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      lines.push({ text: "", isSpacer: true, lineHeight: bodyStyle.lineHeight * 0.6 });
      return;
    }
    let style = bodyStyle;
    let indent = 0;
    if (isFirstLine) {
      style = titleStyle;
      isFirstLine = false;
    } else if (/^\d+\.\s/.test(line) || line === "ANEXO — AUDITORIA DO CÁLCULO") {
      style = headingStyle;
    }
    let cleanLine = line;
    if (line.startsWith("- ")) {
      cleanLine = line.slice(2);
      indent = bulletIndent;
    }
    wrapParagraph(cleanLine, style, maxWidth, indent, measureText).forEach((wrapped) => {
      lines.push(wrapped);
    });
  });
  return lines;
}

async function renderParecerPages(parecerText, auditoriaText, includeAuditoria) {
  await document.fonts.ready;
  const pageWidth = PDF_PAGE.width * PDF_SCALE;
  const pageHeight = PDF_PAGE.height * PDF_SCALE;
  const marginLeft = PDF_MARGINS.left * PDF_SCALE;
  const marginRight = PDF_MARGINS.right * PDF_SCALE;
  const marginTop = PDF_MARGINS.top * PDF_SCALE;
  const marginBottom = PDF_MARGINS.bottom * PDF_SCALE;
  const maxWidth = pageWidth - marginLeft - marginRight;
  const bulletIndent = 18 * PDF_SCALE;

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  const measureText = (text, style) => {
    measureCtx.font = `${style.weight} ${style.size * PDF_SCALE}px "Alegreya Sans", sans-serif`;
    return measureCtx.measureText(text).width;
  };

  const timbrado = await loadTimbradoImage();
  const lines = buildLines(parecerText, auditoriaText, includeAuditoria, measureText, maxWidth, bulletIndent);
  const pages = [];

  let canvas;
  let ctx;
  let cursorY;

  const startPage = () => {
    canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(timbrado, 0, 0, pageWidth, pageHeight);
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    cursorY = marginTop;
  };

  const finishPage = () => {
    if (canvas) pages.push(canvas);
  };

  startPage();

  lines.forEach((line) => {
    const lineHeight = line.lineHeight || 16;
    if (line.isSpacer) {
      cursorY += lineHeight;
      return;
    }
    if (cursorY + lineHeight > pageHeight - marginBottom) {
      finishPage();
      startPage();
    }
    ctx.font = `${line.weight} ${line.size * PDF_SCALE}px "Alegreya Sans", sans-serif`;
    const x = marginLeft + (line.indent || 0);
    ctx.fillText(line.text, x, cursorY);
    cursorY += lineHeight;
  });

  finishPage();
  return pages.map((page) => {
    const dataUrl = page.toDataURL("image/jpeg", 0.92);
    return { bytes: dataUrlToBytes(dataUrl), width: page.width, height: page.height };
  });
}

function buildPdfFromImages(images) {
  const encoder = new TextEncoder();
  const objects = [
    { dict: null },
    { dict: null },
  ];
  const pageObjectNumbers = [];
  let objectNumber = 3;

  images.forEach((image, index) => {
    const imageObjNum = objectNumber++;
    objects.push({
      dict: `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>`,
      streamBytes: image.bytes,
    });
    const content = `q ${PDF_PAGE.width} 0 0 ${PDF_PAGE.height} 0 0 cm /Im${index + 1} Do Q`;
    const contentBytes = encoder.encode(content);
    const contentObjNum = objectNumber++;
    objects.push({
      dict: `<< /Length ${contentBytes.length} >>`,
      streamBytes: contentBytes,
    });
    const pageObjNum = objectNumber++;
    pageObjectNumbers.push(pageObjNum);
    objects.push({
      dict: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE.width} ${PDF_PAGE.height}] /Resources << /XObject << /Im${index + 1} ${imageObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>`,
    });
  });

  objects[1].dict = `<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;
  objects[0].dict = "<< /Type /Catalog /Pages 2 0 R >>";

  const parts = [];
  const offsets = [0];
  let offset = 0;

  const pushBytes = (bytes) => {
    parts.push(bytes);
    offset += bytes.length;
  };

  const pushString = (text) => pushBytes(encoder.encode(text));

  pushString("%PDF-1.4\n%");
  pushBytes(Uint8Array.from([0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  objects.forEach((object, index) => {
    offsets.push(offset);
    pushString(`${index + 1} 0 obj\n`);
    if (object.streamBytes) {
      pushString(`${object.dict}\nstream\n`);
      pushBytes(object.streamBytes);
      pushString("\nendstream\nendobj\n");
    } else {
      pushString(`${object.dict}\nendobj\n`);
    }
  });

  const xrefOffset = offset;
  pushString(`xref\n0 ${objects.length + 1}\n`);
  pushString("0000000000 65535 f \n");
  offsets.slice(1).forEach((objOffset) => {
    pushString(`${String(objOffset).padStart(10, "0")} 00000 n \n`);
  });
  pushString(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
  const output = new Uint8Array(totalLength);
  let position = 0;
  parts.forEach((part) => {
    output.set(part, position);
    position += part.length;
  });
  return output;
}

async function baixarParecerPdf() {
  if (!parecerBox.value) {
    pushAlert("Gere o parecer antes de baixar o PDF.", "warn");
    return;
  }
  try {
    const includeAuditoria = inputAnexarAuditoria.checked;
    const pages = await renderParecerPages(parecerBox.value, auditoriaBox.value, includeAuditoria);
    const pdfBytes = buildPdfFromImages(pages);
    const nome = sanitizeFilename(inputNome.value.trim());
    const filename = `parecer_VAEBA_${nome}_${formatDateForFilename()}.pdf`;
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    pushAlert(err.message || "Erro ao gerar o PDF.", "error");
  }
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const name = file.name.toLowerCase();
  try {
    const text = await file.text();
    if (name.endsWith(".json")) {
      const parsed = JSON.parse(text);
      inpcIndex = { ...parsed };
      uploadStatus.textContent = `INPC carregado com ${Object.keys(inpcIndex).length} competências (JSON).`;
    } else if (name.endsWith(".csv")) {
      const lines = text.split(/\r?\n/).filter(Boolean);
      const map = {};
      lines.forEach((line) => {
        const [comp, idx] = line.split(/;|,/);
        const norm = comp?.trim();
        const val = Number(idx?.trim().replace(/,/g, "."));
        if (norm && !isNaN(val)) map[norm] = val;
      });
      inpcIndex = map;
      uploadStatus.textContent = `INPC carregado com ${Object.keys(inpcIndex).length} competências (CSV).`;
    } else {
      uploadStatus.textContent = "Formato não suportado. Converta para CSV ou JSON simples.";
    }
  } catch (e) {
    uploadStatus.textContent = `Erro ao ler arquivo: ${e.message}`;
  }
}

btnCalcular.addEventListener("click", compute);
btnLimpar.addEventListener("click", limpar);
btnCopiarAuditoria.addEventListener("click", () => copiar(auditoriaBox, btnCopiarAuditoria));
btnCopiarParecer.addEventListener("click", () => copiar(parecerBox, btnCopiarParecer));
btnBaixarParecer.addEventListener("click", baixarParecerPdf);
uploadInput.addEventListener("change", handleUpload);

// Sanidade de dados INPC para informação de auditoria
(function sanityCheckINPC() {
  const base = "2024-01";
  const final = "2025-11";
  if (inpcIndex[base] && inpcIndex[final]) {
    const fat = inpcIndex[final] / inpcIndex[base];
    if (Math.abs(fat - INPC_SANITY_TARGET) > 0.05) {
      uploadStatus.textContent = `Aviso: FATCOR(2024-01→2025-11) = ${fat.toFixed(6)} (referência ${INPC_SANITY_TARGET}). Série foi saneada.`;
    }
  }
})();
