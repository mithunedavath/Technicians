import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 lg:px-8">
        <SidebarTrigger className="md:hidden" />
        <div className="flex w-full items-center justify-end gap-4">
            {children}
        </div>
    </header>
  )
}
