import { PageSkeleton } from "@/components/ui/skeleton";

// Skeleton só em telas folha cujas ações redirecionam (boundaries de carregamento remontam o estado dos formulários).
export default function Loading() { return <PageSkeleton />; }
