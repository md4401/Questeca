"""UFPR — Processo Seletivo (vestibular), portal do Núcleo de Concursos: https://servicos.nc.ufpr.br/PortalNC/.
Cada processo tem página própria (Concurso?concurso=PSAAAA); os documentos abrem em obterDocumento?pub=<id> (PDF direto).
O portal publica pouquíssimas provas: ver data/coleta/ufpr-pendencias.txt. Saída: data/coleta/ufpr.csv"""
import re, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import baixar, texto, escrever_csv, sem_acento

B = "https://servicos.nc.ufpr.br/PortalNC/"
INCLUI = re.compile(r"^(prova|caderno|gabarito)|prova e gabarito|caderno de (prova|quest)", re.I)
EXCLUI = re.compile(r"solfejo|coment|relat|rela[cç][aã]o|atendimento|datas|programa|guia|edital|retifica|termo|nota|comunicado|local|simulado|tutorial", re.I)
linhas = []; pend = []; resumo = {}
for ano in range(2018, 2028):
    fonte = f"{B}Concurso?concurso=PS{ano}"
    h = baixar(fonte)
    if not h: pend.append(f"{ano}: página do processo seletivo inacessível: {fonte}"); continue
    n = 0; total = 0
    for m in re.finditer(r'<h3 class="publicacao-title"><a href="PublicacaoDocumento\?pub=(\d+)"[^>]*>(.*?)</a>', h, re.S):
        total += 1
        t = texto(re.sub(r"<br\s*/?>", " ", m.group(2))); pub = m.group(1)
        if not INCLUI.search(t): continue
        if EXCLUI.search(sem_acento(t)) and not re.search(r"prova e gabarito", t, re.I): pend.append(f"{ano}: EXCLUÍDO: {t[:70]}"); continue
        tn = sem_acento(t)
        fase = "2ª fase" if re.search(r"2 ?a? ?fase|segunda fase", tn) else ("1ª fase" if re.search(r"1 ?a? ?fase|primeira fase", tn) else "Não informada")
        tipo = "gabarito" if re.search(r"gabarito", tn) and not re.search(r"prova e gabarito", tn) else "prova"
        rotulo = ("Prova e gabarito definitivo — " if "prova e gabarito" in tn else ("Prova — " if tipo == "prova" else "Gabarito — ")) + re.sub(r"^(prova e gabarito definitivo\s*-\s*|prova\s*(de)?\s*)", "", t, flags=re.I)[:70]
        aplic = "Prova de habilidade específica (Música)" if "phe" in tn else ""
        linhas.append(dict(instituicao="ufpr", ano=ano, nome=f"UFPR {ano} · Processo Seletivo" + (f" · {fase}" if fase != "Não informada" else " · Provas") + (" · Habilidade específica" if aplic else ""), tipo=tipo, rotulo=rotulo, url=f"{B}obterDocumento?pub={pub}", formato="pdf", fonte=fonte, fase=fase, dia="", aplicacao=aplic, versao="", origem="oficial", observacao=""))
        n += 1
    resumo[ano] = (n, total); print(ano, n, "de", total, "documentos listados")
escrever_csv("data/coleta/ufpr.csv", linhas)
pend.append("O portal publica, por processo seletivo, editais, relações e comunicados; provas e gabaritos da 1ª fase NÃO aparecem em nenhum PS2018–PS2027 (conferidos todos os títulos). Anos anteriores a 2018 não existem no portal (Processos?ano=2003–2017 não lista o vestibular). O site antigo (www.nc.ufpr.br/index_old.htm) não respondeu.")
pend.append("Processo Seletivo 2027 muda para fase única (Nota Técnica): provas ainda não aplicadas na data da coleta.")
open("data/coleta/ufpr-pendencias.txt", "w", encoding="utf-8").write("\n".join(pend) + "\n")
