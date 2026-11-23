import { Icon, type IconName } from "@/components/icons";

/** Cabeçalho padrão das páginas: ícone, título, descrição e ações. */
export function PageHead({ icon, title, sub, actions }: { icon: IconName; title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div className="title"><span className="page-icon" aria-hidden><Icon name={icon} size={22} /></span><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div></div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}
