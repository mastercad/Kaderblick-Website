import React from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import BaseModal from './BaseModal';

export interface FeedbackResolveModalProps {
  open: boolean;
  onClose: () => void;
  onResolve: (comment: string) => void;
  feedbackText: string;
}

const FeedbackResolveModal: React.FC<FeedbackResolveModalProps> = ({ open, onClose, onResolve, feedbackText }) => {
  const [comment, setComment] = React.useState('');

  React.useEffect(() => {
    setComment('');
  }, [open]);

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title="Feedback erledigen"
      actions={
        <>
          <Button onClick={onClose} variant="outlined" color="secondary">Abbrechen</Button>
          <Button onClick={() => onResolve(comment)} color="primary" variant="contained">Erledigen</Button>
        </>
      }
    >
      <Typography variant="subtitle1" gutterBottom>Feedback:</Typography>
      <Typography variant="body2" gutterBottom sx={{
        color: "text.secondary"
      }}>{feedbackText}</Typography>
      <Typography variant="subtitle2" sx={{ mt: 2 }}>Kommentar (optional):</Typography>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={3}
        style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'inherit' }}
      />
    </BaseModal>
  );
};

export default FeedbackResolveModal;
