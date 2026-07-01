"use client"

import * as React from "react"
import {
  IconDashboardFilled,
  IconInnerShadowTop,
} from "@tabler/icons-react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { db } from "../../lib/db"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {

  const user = db.useUser();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">FAYD.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user?.imageURL || ""} alt="" />
            <AvatarFallback className="rounded-lg">GU</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">
              Hello {user.isGuest ? 'Guest' : user.email}!
            </span>
          </div>
        </div>
        <button
          onClick={() => db.auth.signOut()}
          className="bg-blue-600 hidden rounded-lg px-3 py-1 font-bold text-white hover:bg-blue-700"
        >
          Sign out
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}
