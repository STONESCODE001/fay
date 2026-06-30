import { SidebarTrigger } from "@/components/ui/sidebar"
import { IconRefresh } from "@tabler/icons-react"

export function SiteHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#D9DDE8] bg-white px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <span className="h-4 w-px bg-[#D9DDE8]" />
        <h1 className="text-lg font-semibold text-[#111827]">FAYD.</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-full bg-[#F2F4FA] px-3 py-1.5 border border-[#D9DDE8] text-sm font-medium text-[#4B5563]">
          <IconRefresh className="size-4 text-[#4F46E5]" />
          <span>reload</span>
        </div>
      </div>
    </header>
  )
}
