
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SquareIcon from '@mui/icons-material/Square';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import ArrowUpwardAltIcon from '@mui/icons-material/ArrowUpward';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp';
import PanToolIcon from '@mui/icons-material/PanTool';
import BackHandIcon from '@mui/icons-material/BackHand';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import AdjustIcon from '@mui/icons-material/Adjust';
import NotInterestedIcon from '@mui/icons-material/NotInterested';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ExclamationTriangleIcon from '@mui/icons-material/ReportProblem';
import HandHoldingIcon from '@mui/icons-material/EmojiPeople';
import ShoePrintsIcon from '@mui/icons-material/DirectionsWalk';
import UserSlashIcon from '@mui/icons-material/Block';
import UserShieldIcon from '@mui/icons-material/Security';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HourglassFullIcon from '@mui/icons-material/HourglassFull';
import SettingsIcon from '@mui/icons-material/Settings';
import FlagIcon from '@mui/icons-material/Flag';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SyncIcon from '@mui/icons-material/Sync';
import GridViewIcon from '@mui/icons-material/GridView';
import BroomIcon from '@mui/icons-material/CleaningServices';
import VideoCameraFrontIcon from '@mui/icons-material/Videocam';
import LocalDrinkIcon from '@mui/icons-material/LocalDrink';
import AmbulanceIcon from '@mui/icons-material/LocalHospital';
import ToolsIcon from '@mui/icons-material/Build';
import GroupIcon from '@mui/icons-material/Group';
import CommentIcon from '@mui/icons-material/Comment';
import CheckIcon from '@mui/icons-material/Check';
import TimesIcon from '@mui/icons-material/Close';
import ExclamationIcon from '@mui/icons-material/ErrorOutline';
import ForwardIcon from '@mui/icons-material/Forward';
import CogsIcon from '@mui/icons-material/SettingsApplications';
import BanIcon from '@mui/icons-material/Block';
import ShareIcon from '@mui/icons-material/Share';
import RandomIcon from '@mui/icons-material/Shuffle';
import DotCircleIcon from '@mui/icons-material/RadioButtonUnchecked';
import BullseyeIcon from '@mui/icons-material/Adjust';
import GlassWhiskeyIcon from '@mui/icons-material/LocalBar';
import GripLinesIcon from '@mui/icons-material/DragIndicator';
import CompressArrowsAltIcon from '@mui/icons-material/Fullscreen';
import ExchangeAltIcon from '@mui/icons-material/CompareArrows';
import PlusCircleIcon from '@mui/icons-material/AddCircleOutline';
import MinusCircleIcon from '@mui/icons-material/RemoveCircleOutline';
import SquareOutlinedIcon from '@mui/icons-material/SquareOutlined';
import UserIcon from '@mui/icons-material/Person';
import PlayIcon from '@mui/icons-material/PlayArrow';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import ClockIcon from '@mui/icons-material/AccessTime';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
// ... ggf. weitere Icons ergänzen
import React from 'react';

export const GAME_EVENT_ICON_MAP: Record<string, React.ReactNode> = {
  'fas fa-futbol': <SportsSoccerIcon sx={{ verticalAlign: 'middle' }} />,
  'fas fa-square': <SquareIcon sx={{ verticalAlign: 'middle' }} />,
  'fas fa-arrow-right': <ChevronRightOutlined sx={{ verticalAlign: 'middle' }} />,
  'fas fa-arrow-left': <ChevronLeftOutlinedIcon sx={{ verticalAlign: 'middle' }} />,
  'fas fa-arrows-alt-h': <CompareArrowsIcon sx={{ verticalAlign: 'middle' }} />, // Doppelpfeil horizontal
  'fas fa-long-arrow-alt-right': <ChevronRightOutlined sx={{ verticalAlign: 'middle' }} />, // Langer Pfeil rechts
  'fas fa-share': <ShareIcon sx={{ verticalAlign: 'middle' }} />, // Teilen/Flanke
  'fas fa-undo': <UndoIcon sx={{ verticalAlign: 'middle' }} />, // Rückpass
  'fas fa-arrow-up': <ArrowUpwardIcon sx={{ verticalAlign: 'middle' }} />, // Lupfer
  'fas fa-cut': <ContentCutIcon sx={{ verticalAlign: 'middle' }} />, // Schnittstellenpass
  'fas fa-long-arrow-alt-up': <ArrowUpwardIcon sx={{ verticalAlign: 'middle' }} />, // Langer Ball
  'fas fa-random': <ShuffleIcon sx={{ verticalAlign: 'middle' }} />, // Verlagerung
  'fas fa-arrow-circle-up': <ArrowCircleUpIcon sx={{ verticalAlign: 'middle' }} />, // Kopfballpass/-schuss/-tor
  'fas fa-hand-paper': <PanToolIcon sx={{ verticalAlign: 'middle' }} />, // Einwurf, Parade, Handspiel
  'fas fa-hand-rock': <BackHandIcon sx={{ verticalAlign: 'middle' }} />, // Ballannahme, Stoßen
  'fas fa-times-circle': <HighlightOffIcon sx={{ verticalAlign: 'middle' }} />, // Misslungene Ballkontrolle, Ball im Aus
  'fas fa-dot-circle': <RadioButtonUncheckedIcon sx={{ verticalAlign: 'middle' }} />, // Erster Kontakt, Schuss neben das Tor
  'fas fa-minus-circle': <RemoveCircleOutlineIcon sx={{ verticalAlign: 'middle' }} />, // Ballverlust
  'fas fa-bolt': <BoltIcon sx={{ verticalAlign: 'middle' }} />, // Ballverlust (forced), Volley
  'fas fa-plus-circle': <AddCircleOutlineIcon sx={{ verticalAlign: 'middle' }} />, // Ballgewinn
  'fas fa-running': <DirectionsRunIcon sx={{ verticalAlign: 'middle' }} />, // Dribbling, Keeper Rush
  'fas fa-bullseye': <AdjustIcon sx={{ verticalAlign: 'middle' }} />, // Schuss aufs Tor
  'fas fa-ban': <NotInterestedIcon sx={{ verticalAlign: 'middle' }} />, // Geblockter Schuss, Abseits
  'fas fa-check': <CheckIcon sx={{ verticalAlign: 'middle' }} />, // VAR bestätigt
  'fas fa-times': <TimesIcon sx={{ verticalAlign: 'middle' }} />, // VAR abgelehnt, Elfmeter vergeben
  'fas fa-exclamation-triangle': <ExclamationTriangleIcon sx={{ verticalAlign: 'middle' }} />, // Foul
  'fas fa-hand-holding': <HandHoldingIcon sx={{ verticalAlign: 'middle' }} />, // Halten (Foul)
  'fas fa-shoe-prints': <ShoePrintsIcon sx={{ verticalAlign: 'middle' }} />, // Bein stellen, Tritt
  'fas fa-user-slash': <UserSlashIcon sx={{ verticalAlign: 'middle' }} />, // Unsportlichkeit
  'fas fa-user-shield': <UserShieldIcon sx={{ verticalAlign: 'middle' }} />, // Behinderung Torhüter
  'fas fa-theater-masks': <TheaterComedyIcon sx={{ verticalAlign: 'middle' }} />, // Simulation
  'fas fa-hourglass-end': <HourglassEmptyIcon sx={{ verticalAlign: 'middle' }} />, // Zeitspiel
  'fas fa-hourglass-half': <HourglassFullIcon sx={{ verticalAlign: 'middle' }} />, // Spielverzögerung
  'fas fa-cogs': <CogsIcon sx={{ verticalAlign: 'middle' }} />, // Technisches Vergehen
  'fas fa-flag': <FlagIcon sx={{ verticalAlign: 'middle' }} />, // Ecke
  'fas fa-play': <PlayArrowIcon sx={{ verticalAlign: 'middle' }} />, // Anstoß, Halbzeitbeginn
  'fas fa-stop': <StopIcon sx={{ verticalAlign: 'middle' }} />, // Halbzeitende
  'fas fa-clock': <AccessTimeIcon sx={{ verticalAlign: 'middle' }} />, // Verlängerung
  'fas fa-sync': <SyncIcon sx={{ verticalAlign: 'middle' }} />, // Gegenpressing
  'fas fa-grip-lines': <GripLinesIcon sx={{ verticalAlign: 'middle' }} />, // Stellungsspiel
  'fas fa-compress-arrows-alt': <FullscreenIcon sx={{ verticalAlign: 'middle' }} />, // Pressing
  'fas fa-exchange-alt': <CompareArrowsIcon sx={{ verticalAlign: 'middle' }} />, // Spielerwechsel
  'fas fa-ambulance': <AmbulanceIcon sx={{ verticalAlign: 'middle' }} />, // Verletzung
  'fas fa-video': <VideoCameraFrontIcon sx={{ verticalAlign: 'middle' }} />, // VAR
  'fas fa-glass-whiskey': <LocalBarIcon sx={{ verticalAlign: 'middle' }} />, // Trinkpause
  'fas fa-comment': <CommentIcon sx={{ verticalAlign: 'middle' }} />, // Verwarnung
  'fas fa-forward': <ForwardIcon sx={{ verticalAlign: 'middle' }} />, // Vorteil
  'fas fa-tools': <ToolsIcon sx={{ verticalAlign: 'middle' }} />, // Technische Probleme
  'fas fa-users': <GroupIcon sx={{ verticalAlign: 'middle' }} />, // Unsportliches Verhalten außen
  'fas fa-user': <UserIcon sx={{ verticalAlign: 'middle' }} />, // Schiedsrichter
  'fas fa-hands-helping': <HandshakeIcon sx={{ verticalAlign: 'middle' }} />, // Vorlage / Torvorlage
};

// Hilfsfunktion für dynamischen Zugriff
export function getGameEventIconByCode(code: string) {
    return GAME_EVENT_ICON_MAP[code] ?? null;
}
