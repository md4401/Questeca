import { Form, SubmitButton } from "@/components/form";
import { saveAvatarAction } from "@/lib/profile-actions";

export function AvatarForm({ userId, name, has, v }: { userId: string; name: string; has: boolean; v?: number }) {
  return (
    <section className="card"><h2 className="mb-2 text-lg">Foto de perfil (opcional)</h2>
      <div className="mb-3 flex items-center gap-4">
        {has /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={`/api/avatar/${userId}?v=${v ?? 0}`} alt={`Foto de ${name}`} className="h-16 w-16 rounded-full object-cover" /> : <span aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-brand-tint text-2xl font-bold text-brand-dark">{name.trim().charAt(0).toUpperCase()}</span>}
        <p className="hint">PNG, JPG ou WebP até 200 KB. Visível só para você e para a equipe da escola.</p></div>
      <Form action={saveAvatarAction} toast><div className="field"><label htmlFor="avatar">Escolher imagem</label><input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="input" /></div>
        <div className="flex flex-wrap gap-2"><SubmitButton>Salvar foto</SubmitButton>{has && <button className="btn btn-ghost" type="submit" name="remove" value="1">Remover foto</button>}</div></Form>
    </section>
  );
}
