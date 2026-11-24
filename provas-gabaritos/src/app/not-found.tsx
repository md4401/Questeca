import Link from "next/link";
export default function NotFound() { return <div className="card mx-auto max-w-lg text-center"><h1 className="text-3xl">Página não encontrada</h1><p className="mt-2 text-ink-soft">O endereço não existe ou mudou.</p><p className="mt-4"><Link className="btn" href="/">Ver instituições</Link></p></div>; }
