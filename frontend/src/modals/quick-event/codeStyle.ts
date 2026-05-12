import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import FlagIcon from '@mui/icons-material/Flag';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StyleIcon from '@mui/icons-material/Style';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import BackHandIcon from '@mui/icons-material/BackHand';
import type { SvgIconComponent } from '@mui/icons-material';

export interface CodeStyleEntry {
  color: string;
  Icon: SvgIconComponent;
}

/**
 * Farbiger Akzent + MUI-Icon je Event-Code.
 * Wird von QuickEventEventStep und QuickEventRadialMenu gemeinsam genutzt.
 */
export const CODE_STYLE: Record<string, CodeStyleEntry> = {
  goal:                { color: '#4ade80', Icon: SportsSoccerIcon },
  header_goal:         { color: '#4ade80', Icon: SportsSoccerIcon },
  penalty_goal:        { color: '#4ade80', Icon: SportsSoccerIcon },
  freekick_goal:       { color: '#4ade80', Icon: SportsSoccerIcon },
  own_goal:            { color: '#f87171', Icon: SportsSoccerIcon },
  shot_on_target:      { color: '#60a5fa', Icon: GpsFixedIcon },
  shot_post:           { color: '#60a5fa', Icon: GpsFixedIcon },
  shot_bar:            { color: '#60a5fa', Icon: GpsFixedIcon },
  corner:              { color: '#34d399', Icon: FlagIcon },
  assist:              { color: '#c084fc', Icon: EmojiEventsIcon },
  yellow_card:         { color: '#fbbf24', Icon: StyleIcon },
  red_card:            { color: '#f87171', Icon: StyleIcon },
  yellow_red_card:     { color: '#fb923c', Icon: StyleIcon },
  substitution:        { color: '#38bdf8', Icon: SwapHorizIcon },
  substitution_in:     { color: '#38bdf8', Icon: SwapHorizIcon },
  substitution_out:    { color: '#38bdf8', Icon: SwapHorizIcon },
  substitution_injury: { color: '#f87171', Icon: SwapHorizIcon },
  foul:                { color: '#fb923c', Icon: BackHandIcon },
  penalty_foul:        { color: '#f87171', Icon: BackHandIcon },
};

export const DEFAULT_CODE_STYLE: CodeStyleEntry = {
  color: '#94a3b8',
  Icon: SportsSoccerIcon,
};

export function getCodeStyle(eventTypeCode: string): CodeStyleEntry {
  return CODE_STYLE[eventTypeCode] ?? DEFAULT_CODE_STYLE;
}
