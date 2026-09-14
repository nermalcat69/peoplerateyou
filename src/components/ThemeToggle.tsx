import { useEffect, useState } from "react";

import { IconMonitor, IconMoon, IconSun } from "./icons";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "rankd-theme";

function applyTheme(theme: Theme) {
	if (theme === "system") {
		delete document.documentElement.dataset.theme;
		localStorage.removeItem(STORAGE_KEY);
	} else {
		document.documentElement.dataset.theme = theme;
		localStorage.setItem(STORAGE_KEY, theme);
	}
}

const OPTIONS = [
	{ value: "light", label: "Light", icon: IconSun },
	{ value: "dark", label: "Dark", icon: IconMoon },
	{ value: "system", label: "System", icon: IconMonitor },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
	const [theme, setThemeState] = useState<Theme>("system");

	// The inline anti-flash script (see __root.tsx) already applied the
	// right theme before paint; this just syncs which button looks active.
	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		setThemeState(stored === "light" || stored === "dark" ? stored : "system");
	}, []);

	function pick(value: Theme) {
		setThemeState(value);
		applyTheme(value);
	}

	return (
		<div className="flex gap-1 rounded-lg bg-rankd-elev-2 p-1">
			{OPTIONS.map((opt) => (
				<button
					key={opt.value}
					type="button"
					onClick={() => pick(opt.value)}
					aria-label={opt.label}
					title={opt.label}
					className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${
						theme === opt.value ? "bg-rankd-accent text-white" : "text-rankd-dim hover:text-rankd-text"
					}`}
				>
					<opt.icon size={14} />
					{!compact && opt.label}
				</button>
			))}
		</div>
	);
}
