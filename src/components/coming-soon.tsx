import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-display font-bold">{title}</h1>
      <p className="text-muted-foreground text-sm mt-1">{desc}</p>
      <div className="mt-8 bg-card border rounded-2xl p-10 text-center shadow-card">
        <Construction className="size-12 mx-auto text-muted-foreground/40" />
        <h3 className="font-display font-semibold mt-4">Módulo em construção</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          A estrutura de banco de dados, regras de negócio e triggers automáticos já estão prontos. A interface deste módulo será entregue na próxima iteração.
        </p>
      </div>
    </div>
  );
}

export default ComingSoon;
export { ComingSoon };
