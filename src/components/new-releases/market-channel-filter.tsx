import type { MarketChannel } from "@/data/new-releases.mock";
import { MARKET_CHANNEL_OPTIONS } from "@/lib/new-releases";

type MarketChannelFilterProps = {
  selectedChannel: MarketChannel;
  onSelect: (channel: MarketChannel) => void;
};

export function MarketChannelFilter({
  selectedChannel,
  onSelect,
}: MarketChannelFilterProps) {
  return (
    <div
      aria-label="网易云新发行市场频道"
      className="market-channel-filter"
      role="group"
    >
      {MARKET_CHANNEL_OPTIONS.map((option) => {
        const isSelected = option.value === selectedChannel;

        return (
          <button
            aria-pressed={isSelected}
            key={option.value}
            onClick={() => onSelect(option.value)}
            type="button"
          >
            <span>{option.label}</span>
            {isSelected ? (
              <span className="market-channel-filter__selected">已选</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
