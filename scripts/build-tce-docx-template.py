#!/usr/bin/env python3
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "DOCS/TCE EDITAVEL.docx"
DST = ROOT / "public/templates/tce.docx"

NEEDLE = '<w:t xml:space="preserve"> </w:t>'


def _has_text_run(block: str) -> bool:
    return re.search(r"<w:r[\s>]", block) is not None


def tighten_programa_estagio_section(xml: str) -> str:
    prog = xml.find("PROGRAMA DE ESTÁGIO")
    if prog < 0:
        return xml
    cl3 = xml.find("Cláusula 3", prog)
    if cl3 < 0:
        return xml
    rstart = xml.rfind("<w:p ", 0, prog)
    cl_para_start = xml.rfind("<w:p ", 0, cl3)
    if rstart < 0 or cl_para_start < 0 or cl_para_start <= rstart:
        return xml
    before = xml[:rstart]
    section = xml[rstart:cl_para_start]
    after = xml[cl_para_start:]
    blocks = list(re.finditer(r"<w:p\b[\s\S]*?</w:p>", section))
    new_blocks = []
    for m in blocks:
        blk = m.group(0)
        if not _has_text_run(blk):
            continue
        if "<w:spacing" not in blk:
            blk = re.sub(
                r"(<w:pPr>)",
                r'\1<w:spacing w:before="0" w:after="100" w:line="180" '
                r'w:lineRule="exact"/>',
                blk,
                count=1,
            )
        else:
            blk = re.sub(
                r"<w:spacing[^>]+/>",
                '<w:spacing w:before="0" w:after="100" w:line="180" '
                'w:lineRule="exact"/>',
                blk,
                count=1,
            )
        new_blocks.append(blk)
    return before + "".join(new_blocks) + after


def zero_supervisor_paragraph_after_spacing(xml: str) -> str:
    def repl_para(match: re.Match[str]) -> str:
        block = match.group(0)
        texts = "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", block))
        t = texts.strip()
        if t == "Supervisor de Estágio" or (
            "Nome:" in texts and "supervisor_nome" in block
        ):
            block = re.sub(
                r'(w:after=")\d+(")',
                r"\g<1>0\2",
                block,
                count=1,
            )
        return block

    return re.sub(r"<w:p\b[\s\S]*?</w:p>", repl_para, xml)


def merge_reitor_into_previous_ie_paragraph(xml: str) -> str:
    needle = "{ie_reitor}"
    pos = xml.find(needle)
    if pos < 0:
        return xml
    p_start = xml.rfind("<w:p ", 0, pos)
    if p_start < 0:
        return xml
    p_end = xml.find("</w:p>", pos)
    if p_end < 0:
        return xml
    p_end += len("</w:p>")
    reitor_para = xml[p_start:p_end]
    if len(reitor_para) > 1500:
        return xml
    inner_m = re.search(r"</w:pPr>([\s\S]*?)</w:p>", reitor_para)
    if not inner_m:
        return xml
    inner_runs = inner_m.group(1)
    prev_p_start = xml.rfind("<w:p ", 0, p_start - 1)
    if prev_p_start < 0:
        return xml
    prev_seg = xml[prev_p_start:p_start]
    insert_before = prev_seg.rfind("</w:p>")
    if insert_before < 0:
        return xml
    inner_prev = prev_seg[:insert_before]
    last_r_close = inner_prev.rfind("</w:r>")
    if last_r_close < 0:
        return xml
    ins_at = prev_p_start + last_r_close + len("</w:r>")
    br = (
        '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
        '<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'
        '<w:br w:type="textWrapping"/></w:r>'
    )
    return xml[:ins_at] + br + inner_runs + xml[ins_at:p_start] + xml[p_end:]


def add_spacing_between_ie_and_estudante_boxes(xml: str) -> str:
    needle = "Estudante:</w:t>"
    pos = xml.find(needle)
    if pos < 0:
        return xml
    p_start = xml.rfind("<w:p ", 0, pos)
    if p_start < 0:
        return xml
    ppr_start = xml.find("<w:pPr>", p_start, pos)
    if ppr_start < 0:
        return xml
    sp_start = xml.find("<w:spacing ", ppr_start, pos)
    if sp_start < 0:
        return xml
    sp_end = xml.find("/>", sp_start) + 2
    new_sp = '<w:spacing w:before="80" w:line="200" w:lineRule="exact"/>'
    return xml[:sp_start] + new_sp + xml[sp_end:]


def inject_ie_assinatura_image_placeholder(xml: str) -> str:
    para_img = (
        '<w:p w14:paraId="77IEIMG01" w14:textId="77777777" w:rsidR="0096791D" '
        'w:rsidRDefault="0096791D" w:rsidP="00CE4AC0">'
        '<w:pPr><w:pStyle w:val="Corpodetexto"/><w:jc w:val="center"/>'
        '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
        '<w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
        '<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'
        "<w:t>{%ie_assinatura}</w:t></w:r></w:p>"
    )
    xml = re.sub(
        r"<w:p\b[^>]*>[\s\S]*?\{%ie_assinatura\}[\s\S]*?</w:p>\s*",
        "",
        xml,
        count=1,
    )
    lab = "<w:t>Instituição de Ensino</w:t>"
    li = xml.rfind(lab)
    if li < 0:
        return xml
    und = xml.rfind("___________________________________________________", 0, li)
    if und < 0:
        return xml
    insert_at = xml.find("</w:p>", und)
    if insert_at < 0:
        return xml
    insert_at += len("</w:p>")
    return xml[:insert_at] + para_img + xml[insert_at:]


def replace_brasilia_date_line_paragraph(xml: str) -> str:
    token = "{data_assinatura}"
    pos = xml.find(token)
    if pos < 0:
        return xml
    p_start = xml.rfind("<w:p ", 0, pos)
    if p_start < 0:
        return xml
    p_end = xml.find("</w:p>", pos)
    if p_end < 0:
        return xml
    p_end += len("</w:p>")
    old_block = xml[p_start:p_end]
    open_m = re.match(r"(<w:p\b[^>]*>)", old_block)
    if not open_m:
        return xml
    open_tag = open_m.group(1)
    rpr = (
        "<w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\" w:cs=\"Arial\"/>"
        "<w:b/><w:sz w:val=\"16\"/><w:szCs w:val=\"16\"/></w:rPr>"
    )
    new_inner = (
        f"<w:r>{rpr}<w:t>Brasília</w:t></w:r>"
        f"<w:r>{rpr}"
        f"<w:t xml:space=\"preserve\">, ______ de ______ de ______</w:t></w:r>"
    )
    new_block = open_tag + new_inner + "</w:p>"
    return xml[:p_start] + new_block + xml[p_end:]


KEYS = [
    "hdr_blank_a",
    "hdr_blank_b",
    "empresa_razao",
    "empresa_endereco",
    "empresa_bairro",
    "spacer_pre_cidade_row",
    "empresa_cep",
    "empresa_cnpj_a",
    "empresa_cnpj_b",
    "empresa_responsavel",
    "empresa_rep_extra",
    "ie_nome_display",
    "ie_razao_social",
    "ie_razao_extra",
    "ie_telefone",
    "ie_cep",
    "est_nome",
    "est_row_spacer_17",
    "est_row_spacer_18",
    "est_data_nascimento",
    "est_telefone",
    "resp_legal_nome",
    "est_rg",
    "est_rg_spacer_23",
    "est_cpf_spacer_24",
    "est_cpf",
    "est_endereco",
    "est_bairro",
    "est_addr_spacer_28",
    "est_addr_spacer_29",
    "est_addr_spacer_30",
    "est_addr_spacer_31",
    "est_cep",
    "est_clause_spacer",
    "estagio_periodo",
    "bolsa_valor",
    "seguro_spacer",
    "apolice_numero",
    "supervisor_nome",
    "supervisor_cargo",
    "sup_spacer_40",
    "sup_spacer_41",
    "data_assinatura",
]


def patch_xml(xml: str) -> str:
    positions = []
    idx = 0
    while True:
        j = xml.find(NEEDLE, idx)
        if j < 0:
            break
        positions.append(j)
        idx = j + 1
    if len(positions) != len(KEYS):
        raise SystemExit(
            f"needle count {len(positions)} != keys {len(KEYS)}"
        )
    for pos, key in sorted(zip(positions, KEYS), key=lambda x: -x[0]):
        repl = f'<w:t xml:space="preserve"> {{{key}}}</w:t>'
        xml = xml[:pos] + repl + xml[pos + len(NEEDLE) :]

    xml = xml.replace(
        "<w:t xml:space=\"preserve\">Estado:            </w:t>",
        "<w:t xml:space=\"preserve\">Estado: {empresa_uf} </w:t>",
        1,
    )

    est_uf_pat = (
        "<w:t>Estado:</w:t></w:r>"
        '<w:r w:rsidR="001D019D"><w:rPr><w:rFonts w:ascii="Arial" '
        'w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/>'
        "</w:rPr>"
        '<w:t xml:space="preserve">              </w:t>'
    )
    est_uf_repl = (
        "<w:t>Estado:</w:t></w:r>"
        '<w:r w:rsidR="001D019D"><w:rPr><w:rFonts w:ascii="Arial" '
        'w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/>'
        "</w:rPr>"
        "<w:t xml:space=\"preserve\"> {est_uf} </w:t>"
    )
    if est_uf_pat not in xml:
        raise SystemExit("estudante Estado pattern not found")
    xml = xml.replace(est_uf_pat, est_uf_repl, 1)

    ie_cnpj_pat = (
        "<w:t xml:space=\"preserve\">"
        "                                                                                                                     "
        "CNPJ: </w:t>"
    )
    ie_cnpj_repl = (
        "<w:t xml:space=\"preserve\">"
        "                                                                                                                     "
        "CNPJ: {ie_cnpj} </w:t>"
    )
    if ie_cnpj_pat not in xml:
        raise SystemExit("IE CNPJ pattern not found")
    xml = xml.replace(ie_cnpj_pat, ie_cnpj_repl, 1)

    rg7 = "<w:t xml:space=\"preserve\">       </w:t>"
    xml = xml.replace(rg7, "<w:t xml:space=\"preserve\"> {est_rg}</w:t>", 1)

    email_pat = (
        "<w:t xml:space=\"preserve\">: </w:t></w:r></w:p>"
        '<w:p w14:paraId="6E4104E8"'
    )
    email_repl = (
        "<w:t xml:space=\"preserve\">: </w:t></w:r>"
        '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
        '<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'
        "<w:t xml:space=\"preserve\"> {est_email}</w:t>"
        "</w:r></w:p>"
        '<w:p w14:paraId="6E4104E8"'
    )
    if email_pat not in xml:
        raise SystemExit("email injection pattern not found")
    xml = xml.replace(email_pat, email_repl, 1)

    sp12 = "<w:t xml:space=\"preserve\">            </w:t>"
    parts = xml.split(sp12)
    if len(parts) != 5:
        raise SystemExit(f"12-space runs expected 4, got {len(parts)-1}")
    keys12 = [
        "empresa_cidade_line",
        "est_rg_line_pad",
        "est_cidade_pad_a",
        "est_bairro_pad",
    ]
    out = parts[0]
    for i, k in enumerate(keys12):
        out += f'<w:t xml:space="preserve"> {{{k}}}</w:t>' + parts[i + 1]
    xml = out

    sp16 = "<w:t xml:space=\"preserve\">                </w:t>"
    xml = xml.replace(
        sp16,
        '<w:t xml:space="preserve"> {empresa_cidade_tail}</w:t>',
        1,
    )

    ie_reitor_empty_pat = (
        '<w:p w14:paraId="17B318AF" w14:textId="77777777" w:rsidR="0096791D" '
        'w:rsidRPr="00040859" w:rsidRDefault="0096791D" w:rsidP="00196FF6">'
        "<w:pPr><w:spacing w:line=\"200\" w:lineRule=\"exact\"/>"
        '<w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" '
        'w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr></w:p>'
    )
    ie_reitor_repl = (
        '<w:p w14:paraId="17B318AF" w14:textId="77777777" w:rsidR="0096791D" '
        'w:rsidRPr="00040859" w:rsidRDefault="0096791D" w:rsidP="00196FF6">'
        "<w:pPr><w:spacing w:line=\"200\" w:lineRule=\"exact\"/>"
        '<w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" '
        'w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr>'
        '<w:r w:rsidRPr="00040859"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" '
        'w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'
        "<w:t>Reitor(a):</w:t></w:r>"
        '<w:r w:rsidR="00REITOR"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" '
        'w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'
        '<w:t xml:space="preserve"> {ie_reitor}</w:t></w:r></w:p>'
    )
    if ie_reitor_empty_pat in xml:
        xml = xml.replace(ie_reitor_empty_pat, ie_reitor_repl, 1)

    _ie_cep_reitor_merge = re.compile(
        r'(<w:r w:rsidR="007C505A"><w:rPr><w:rFonts w:ascii="Arial" '
        r'w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="16"/>'
        r'<w:szCs w:val="16"/></w:rPr><w:tab/></w:r>)'
        r'</w:p><w:p w14:paraId="17REITOR" w14:textId="77REITOR" '
        r'w:rsidR="0088059B" w:rsidRPr="0088059B" w:rsidRDefault="0096791D" '
        r'w:rsidP="000D5310">'
        r'<w:pPr><w:pStyle w:val="Ttulo1"/><w:pBdr>.*?</w:pBdr>'
        r'<w:spacing w:line="200" w:lineRule="exact"/><w:jc w:val="both"/>'
        r'<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'
        r'<w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr>'
        r'(<w:r w:rsidRPr="00040859">.*?</w:r></w:p>)',
        re.DOTALL,
    )
    _m = _ie_cep_reitor_merge.search(xml)
    if _m:
        _tab = _m.group(1)
        _reitor_runs = _m.group(2)[: -len("</w:p>")]
        xml = _ie_cep_reitor_merge.sub(
            _tab + _reitor_runs + "</w:p>", xml, count=1
        )

    xml = merge_reitor_into_previous_ie_paragraph(xml)
    xml = add_spacing_between_ie_and_estudante_boxes(xml)

    _carimbo_tight = (
        '<w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/>'
        '<w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" '
        'w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/></w:rPr>'
        '<w:t xml:space="preserve"> </w:t></w:r></w:p><w:p w14:paraId="4CC6BB61"'
    )
    _carimbo_tight_new = (
        '<w:spacing w:before="0" w:after="0" w:line="80" w:lineRule="exact"/>'
        '<w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" '
        'w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="16"/></w:rPr>'
        '<w:t xml:space="preserve"> </w:t></w:r></w:p><w:p w14:paraId="4CC6BB61"'
    )
    if _carimbo_tight in xml:
        xml = xml.replace(_carimbo_tight, _carimbo_tight_new, 1)

    xml = tighten_programa_estagio_section(xml)
    xml = zero_supervisor_paragraph_after_spacing(xml)
    xml = inject_ie_assinatura_image_placeholder(xml)
    xml = replace_brasilia_date_line_paragraph(xml)

    return xml


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"missing source: {SRC}")
    DST.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(SRC, "r") as zin:
        names = zin.namelist()
        raw = {n: zin.read(n) for n in names}
    xml_in = raw["word/document.xml"].decode("utf-8")
    xml_out = patch_xml(xml_in)
    raw["word/document.xml"] = xml_out.encode("utf-8")
    with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, raw[n])
    print(f"written {DST}")


if __name__ == "__main__":
    main()
