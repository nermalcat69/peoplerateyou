import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { getSidebarInfoFn } from "../server/people";
import { Avatar } from "../components/Avatar";
import { ThemeToggle } from "../components/ThemeToggle";
import { IconCompass, IconFlame, IconGear, IconImage, IconStar, IconUser, IconUsers } from "../components/icons";

export const Route = createFileRoute("/_authenticated/_dashboard")({
	loader: () => getSidebarInfoFn(),
	component: DashboardLayout,
});

const NAV_ITEMS = [
	{ to: "/profile", label: "Profile", icon: IconUser },
	{ to: "/people-rated", label: "People Rated", icon: IconUsers },
	{ to: "/ratings", label: "Ratings", icon: IconStar },
	{ to: "/discover", label: "Discover", icon: IconCompass },
	{ to: "/settings", label: "Settings", icon: IconGear },
] as const;

function DashboardLayout() {
	const me = Route.useLoaderData();

	return (
		<div className="min-h-screen bg-rankd-bg text-rankd-text font-body flex">
			{/* Sidebar (desktop) */}
			<aside className="hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen w-60 shrink-0 border-r border-rankd-border p-4">
				<div className="font-display text-2xl font-extrabold px-3 tracking-wide">
					RANK<span className="text-rankd-accent">D</span>
				</div>

				<nav className="flex flex-col gap-1.5 mt-8">
					{NAV_ITEMS.map((item) => (
						<Link
							key={item.to}
							to={item.to}
							className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-rankd-dim"
							activeProps={{ className: "!bg-rankd-accent !text-white" }}
						>
							<item.icon size={20} />
							{item.label}
						</Link>
					))}
				</nav>

				<div className="grow" />

				<ThemeToggle compact />

				<div className="flex items-center gap-2.5 pt-4 mt-4 border-t border-rankd-border">
					<Avatar id={me.id} name={me.name} image={me.image} size="sm" />
					<div className="min-w-0 leading-tight">
						<div className="text-sm font-bold truncate">{me.name}</div>
						<div className="text-xs text-rankd-faint truncate">@{me.username}</div>
					</div>
				</div>
			</aside>

			{/* Main + right rail */}
			<div className="flex-1 min-w-0 flex">
				<main className="flex-1 min-w-0 p-5 md:p-10 pb-24 md:pb-10 flex flex-col gap-6">
					<Outlet />
				</main>

				<aside className="hidden lg:flex lg:flex-col w-[280px] shrink-0 border-l border-rankd-border p-6 gap-5">
					<div className="rounded-2xl bg-rankd-elev border border-rankd-border px-4 py-3.5 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<IconFlame className="text-rankd-yellow" />
							<span className="text-xs font-semibold text-rankd-dim">Rating Streak</span>
						</div>
						<span className="font-display text-base font-extrabold text-rankd-yellow">6 DAYS</span>
					</div>

					<div className="rounded-2xl bg-rankd-elev border border-rankd-border p-5 flex flex-col items-center justify-center gap-2.5 aspect-[248/320]">
						<div className="text-[10px] tracking-widest font-bold text-rankd-faint">ADVERTISEMENT</div>
						<IconImage className="text-rankd-faint" />
						<div className="font-display text-lg font-extrabold text-rankd-dim text-center leading-tight">
							YOUR BRAND
							<br />
							COULD BE HERE
						</div>
						<div className="text-[11px] text-rankd-faint text-center">Reserved ad placement</div>
					</div>

					<div className="flex gap-3 text-[11px] text-rankd-faint mt-auto">
						<a href="#" className="hover:text-rankd-text">
							Terms of Use
						</a>
						<span>·</span>
						<a href="#" className="hover:text-rankd-text">
							Privacy Policy
						</a>
					</div>
				</aside>
			</div>

			{/* Bottom nav (mobile) */}
			<nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-rankd-border bg-rankd-bg flex items-center justify-around py-2">
				{NAV_ITEMS.map((item) => (
					<Link
						key={item.to}
						to={item.to}
						className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-rankd-dim"
						activeProps={{ className: "!text-rankd-accent" }}
					>
						<item.icon size={20} />
						<span className="text-[10px] font-semibold">{item.label}</span>
					</Link>
				))}
			</nav>
		</div>
	);
}
