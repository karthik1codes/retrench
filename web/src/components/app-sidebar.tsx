"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  LayoutDashboardIcon,
  ListIcon,
  RadarIcon,
  SearchIcon,
  FileTextIcon,
  MailCheckIcon,
  CalendarClockIcon,
} from "lucide-react";
import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { SignalScoutLogo } from "@/components/SignalScoutLogo";
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
    title: "Sent",
    url: "/sent",
    icon: <MailCheckIcon />,
  },
  {
    title: "Follow-ups",
    url: "/follow-ups",
    icon: <CalendarClockIcon />,
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
  {
    name: "Sent mailbox",
    url: "/sent",
    icon: <MailCheckIcon />,
  },
  {
    name: "Follow-up queue",
    url: "/follow-ups",
    icon: <CalendarClockIcon />,
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
              <SignalScoutLogo
                className="size-6 rounded-md"
                iconClassName="size-3.5"
              />
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
