"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  LayoutDashboardIcon,
  ListIcon,
  RadarIcon,
  SearchIcon,
  FileTextIcon,
} from "lucide-react";
import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navMain = [
  {
    title: "Scout",
    url: "/scout",
    icon: <RadarIcon />,
  },
  {
    title: "Watchlist",
    url: "/watchlist",
    icon: <ListIcon />,
  },
  {
    title: "Overview",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
  },
];

const navSecondary = [
  {
    title: "Find a company",
    url: "/scout",
    icon: <SearchIcon />,
  },
];

const documents = [
  {
    name: "This week's drafts",
    url: "/watchlist",
    icon: <FileTextIcon />,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data } = useSession();
  const user = {
    name: data?.user?.name || "Signal Scout",
    email: data?.user?.email || "Sign in to continue",
    avatar: data?.user?.image || "",
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <span className="flex size-5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                <RadarIcon className="size-3.5" />
              </span>
              <span className="text-base font-semibold">Signal Scout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavDocuments items={documents} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
