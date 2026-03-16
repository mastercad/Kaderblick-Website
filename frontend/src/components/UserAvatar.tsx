import React from "react";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Badge from "@mui/material/Badge";
import { FaUserAlt } from "react-icons/fa";
import { BACKEND_URL } from "../../config";
import { getAvatarFrameUrl } from '../utils/avatarFrame';
// Alternativ: import { FaFutbol } from "react-icons/fa";

interface UserProps {
  icon: React.ReactNode | string; // Avatar-URL oder Icon-Komponente
  name: string;
  titleObj?: { hasTitle?: boolean; avatarFrame?: string; displayTitle?: { displayName?: string } | string | null; allTitles?: { [key: number]: string } };
  xp?: number;
  avatarSize?: number; // px
  fontSize?: number; // px
  svgFrame?: React.ReactNode; // Optionales SVG-Overlay (Rahmen, bleibt für Kompatibilität)
  svgFrameUrl?: string; // Optionaler SVG-Dateipfad als Overlay (deprecated, use titleObj)
  svgFrameOffsetY?: number; // Optionaler vertikaler Offset für den Rahmen (in px)
  level?: number; // Optional: Level des Benutzers
}

export const UserAvatar: React.FC<UserProps> = ({ icon, name, avatarSize = 48, fontSize = 16, svgFrame, svgFrameUrl, svgFrameOffsetY = 0, level, titleObj }) => {
  // Icon size for react-icon inside Avatar (slightly smaller than avatarSize)
  const iconInnerSize = Math.round(avatarSize * 0.6);
  let avatarContent: React.ReactNode;
  // Determine title for tooltip (if available)
  const displayTitleRaw = titleObj?.hasTitle ? titleObj.displayTitle : undefined;
  const userTitle = displayTitleRaw
    ? (typeof displayTitleRaw === 'string' ? displayTitleRaw : displayTitleRaw.displayName)
    : undefined;
  if (typeof icon === "string") {
    if (icon && icon.trim() !== "") {
      const src = icon.startsWith('http') ? icon : `${BACKEND_URL}/uploads/avatar/${icon}`;
      avatarContent = <Avatar src={src} alt="Avatar" sx={{ width: avatarSize, height: avatarSize }} />;
    } else {
      avatarContent = <Avatar sx={{ width: avatarSize, height: avatarSize }}><FaUserAlt size={iconInnerSize} /></Avatar>;
    }
  } else if (icon) {
    avatarContent = <Avatar sx={{ width: avatarSize, height: avatarSize }}>{icon}</Avatar>;
  } else {
    avatarContent = <Avatar sx={{ width: avatarSize, height: avatarSize }}><FaUserAlt size={iconInnerSize} /></Avatar>;
  }

  // svgFrameUrl: Priorität: titleObj → prop.svgFrameUrl → prop.svgFrame
  const frameUrl = titleObj ? getAvatarFrameUrl(titleObj) : svgFrameUrl;
  return (
    <Box display="flex" alignItems="center" sx={{ display: 'inline-flex' }}>
      <Tooltip title={userTitle || ''} disableHoverListener={!userTitle} arrow>
        <Box sx={{ position: 'relative', width: avatarSize, height: avatarSize, minWidth: avatarSize, minHeight: avatarSize, mr: name && name.trim() !== '' ? 1 : 0, display: 'inline-block' }}>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={null}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: avatarSize,
              height: avatarSize,
              zIndex: 1,
              '& .MuiBadge-badge': {
                border: '2px solid #fff',
                padding: 0,
              },
            }}
          >
            {avatarContent}
          </Badge>
          {(frameUrl || svgFrame) && (
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 2,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: svgFrameOffsetY !== 0 ? `translateY(${svgFrameOffsetY}px)` : `translateY(-7px)`,
            }}>
              {frameUrl ? (
                <img
                  src={frameUrl}
                  alt="Avatar Rahmen"
                  style={{ width: '140%', height: '160%', objectFit: 'contain', pointerEvents: 'none' }}
                  draggable={false}
                />
              ) : svgFrame}
            </Box>
          )}
          {level !== undefined && level !== null && (
            <Box sx={{
              position: 'absolute',
              left: '50%',
              bottom: -10,
              transform: 'translateX(-50%)',
              zIndex: 3,
              /*background: 'primary.main',*/
              color: 'primary.text',
              /*borderRadius: '12px',*/
              px: 1.2,
              py: 0.2,
              fontWeight: 700,
              fontSize: Math.max(avatarSize * 0.32, 12),
              minWidth: avatarSize * 0.5,
              textAlign: 'center',
              /*boxShadow: '0 2px 6px rgba(0,0,0,0.25)',*/
              userSelect: 'none',
            }}>
              {level}
            </Box>
          )}
        </Box>
      </Tooltip>
      {name && name.trim() !== '' && (
        <Typography variant="subtitle1" fontWeight={500} fontSize={fontSize}>
          {name}
        </Typography>
      )}
    </Box>
  );
};

export default UserAvatar;
