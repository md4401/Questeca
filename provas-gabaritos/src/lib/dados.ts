// Gerado por scripts/gerar-dados.ts — não edite à mão. Um arquivo de edições por instituição.
import instituicoes from "../../data/instituicoes.json";
import verificacao from "../../data/verificacao.json";
import e_enem from "../../data/edicoes/enem.json";
import e_fuvest from "../../data/edicoes/fuvest.json";
import e_comvest from "../../data/edicoes/comvest.json";
import e_vunesp from "../../data/edicoes/vunesp.json";
import e_univesp from "../../data/edicoes/univesp.json";
import e_fatec from "../../data/edicoes/fatec.json";
import e_uerj from "../../data/edicoes/uerj.json";
import e_ufpr from "../../data/edicoes/ufpr.json";
import e_ufrgs from "../../data/edicoes/ufrgs.json";
import e_pas_unb from "../../data/edicoes/pas-unb.json";
import e_ita from "../../data/edicoes/ita.json";
import e_ime from "../../data/edicoes/ime.json";
import e_espcex from "../../data/edicoes/espcex.json";
import e_afa from "../../data/edicoes/afa.json";
import e_fgv from "../../data/edicoes/fgv.json";
import e_insper from "../../data/edicoes/insper.json";
import e_puc_sp from "../../data/edicoes/puc-sp.json";
import e_mackenzie from "../../data/edicoes/mackenzie.json";
import e_einstein from "../../data/edicoes/einstein.json";
import e_espm from "../../data/edicoes/espm.json";

export const INSTITUICOES_BRUTAS: unknown = instituicoes;
export const VERIFICACAO_BRUTA: unknown = verificacao;
export const EDICOES_BRUTAS: Record<string, unknown> = {
  "enem": e_enem,
  "fuvest": e_fuvest,
  "comvest": e_comvest,
  "vunesp": e_vunesp,
  "univesp": e_univesp,
  "fatec": e_fatec,
  "uerj": e_uerj,
  "ufpr": e_ufpr,
  "ufrgs": e_ufrgs,
  "pas-unb": e_pas_unb,
  "ita": e_ita,
  "ime": e_ime,
  "espcex": e_espcex,
  "afa": e_afa,
  "fgv": e_fgv,
  "insper": e_insper,
  "puc-sp": e_puc_sp,
  "mackenzie": e_mackenzie,
  "einstein": e_einstein,
  "espm": e_espm,
};
