export function RatingScale({
	value,
	onPick,
	disabled,
}: {
	value: number | null;
	onPick: (score: number) => void;
	disabled?: boolean;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{Array.from({ length: 11 }, (_, score) => (
				<button
					key={score}
					type="button"
					disabled={disabled}
					onClick={() => onPick(score)}
					className={`size-9 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
						value === score ? "bg-rankd-green text-rankd-ink" : "bg-rankd-elev-2 text-rankd-dim hover:text-rankd-text"
					}`}
				>
					{score}
				</button>
			))}
		</div>
	);
}
