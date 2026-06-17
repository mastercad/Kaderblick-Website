import React, { useEffect, useState } from 'react';
import {
	Button, Box, Typography, IconButton, TextField, MenuItem,
	Checkbox, FormControlLabel, FormGroup, Divider, Chip,
	CircularProgress, Alert, Paper, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SportsIcon from '@mui/icons-material/Sports';
import WorkIcon from '@mui/icons-material/Work';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import { apiJson } from '../utils/api';
import { useToast } from '../context/ToastContext';
import BaseModal from './BaseModal';

// ── Typen ────────────────────────────────────────────────────────────────────

export type RelationType = {
	id: number;
	identifier: string;
	name: string;
	category: 'player' | 'coach';
};
export type Player = { id: number; fullName: string; teams?: string[] };
export type Coach = { id: number; fullName: string; teams?: string[] };
export type Relation = {
	id?: string;
	relationType: RelationType | null;
	entity: Player | Coach | null;
	permissions: string[];
};

type RefItem = { id: number; name: string };

export type AssignmentRow = {
	teamId: number | null;
	clubId: number | null;
	typeId: number | null;
	startDate: string;
	endDate: string;
};

export type UserRelationEditModalProps = {
	open: boolean;
	onClose: () => void;
	onSaved?: () => void;
	user: { id: number; fullName: string };
};

/** Technische Berechtigungsnamen in lesbares Deutsch übersetzen */
function formatPermission(perm: string): string {
	const map: Record<string, string> = {
		view: 'Ansehen',
		edit: 'Bearbeiten',
		delete: 'Löschen',
		create: 'Erstellen',
		manage: 'Verwalten',
		view_stats: 'Statistiken ansehen',
		view_health: 'Gesundheitsdaten ansehen',
		edit_profile: 'Profil bearbeiten',
		view_profile: 'Profil ansehen',
		view_training: 'Training ansehen',
		manage_training: 'Training verwalten',
		view_games: 'Spiele ansehen',
		manage_games: 'Spiele verwalten',
		view_documents: 'Dokumente ansehen',
		manage_documents: 'Dokumente verwalten',
		view_attendance: 'Anwesenheit ansehen',
		manage_attendance: 'Anwesenheit verwalten',
		send_message: 'Nachricht senden',
		view_finances: 'Finanzen ansehen',
	};
	return map[perm] ?? perm.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const emptyAssignment = (): AssignmentRow => ({ teamId: null, clubId: null, typeId: null, startDate: '', endDate: '' });

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

const UserRelationEditModal: React.FC<UserRelationEditModalProps> = ({ open, onClose, onSaved, user }) => {
	if (!user || typeof user.id === 'undefined') return null;

	// Spieler / Trainer
	const [playerRelations, setPlayerRelations] = useState<Relation[]>([]);
	const [coachRelations, setCoachRelations] = useState<Relation[]>([]);
	const [relationTypes, setRelationTypes] = useState<RelationType[]>([]);
	const [players, setPlayers] = useState<Player[]>([]);
	const [coaches, setCoaches] = useState<Coach[]>([]);
	const [allPermissions, setAllPermissions] = useState<string[]>([]);

	// Staff / Funktionäre
	const [teams, setTeams] = useState<RefItem[]>([]);
	const [clubs, setClubs] = useState<RefItem[]>([]);
	const [staffTeamTypes, setStaffTeamTypes] = useState<RefItem[]>([]);
	const [staffClubTypes, setStaffClubTypes] = useState<RefItem[]>([]);
	const [functionaryTeamTypes, setFunctionaryTeamTypes] = useState<RefItem[]>([]);
	const [functionaryClubTypes, setFunctionaryClubTypes] = useState<RefItem[]>([]);

	const [staffTeamAssignments, setStaffTeamAssignments] = useState<AssignmentRow[]>([]);
	const [staffClubAssignments, setStaffClubAssignments] = useState<AssignmentRow[]>([]);
	const [functionaryTeamAssignments, setFunctionaryTeamAssignments] = useState<AssignmentRow[]>([]);
	const [functionaryClubAssignments, setFunctionaryClubAssignments] = useState<AssignmentRow[]>([]);

	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const { showToast } = useToast();

	useEffect(() => {
		if (!open) return;
		setLoading(true);
		apiJson(`/admin/users/${user.id}/assign`).then((data) => {
			const flatRelationTypes = Object.values(data.relationTypes || {}).flat() as RelationType[];
			setRelationTypes(flatRelationTypes);
			setPlayers(data.players || []);
			setCoaches(data.coaches || []);
			setAllPermissions((data.permissions || []).map((p: any) => p.name || p));
			setPlayerRelations((data.currentAssignments?.players || []).map((a: any) => ({
				relationType: a.relationType,
				entity: a.entity,
				permissions: a.permissions || [],
			})));
			setCoachRelations((data.currentAssignments?.coaches || []).map((a: any) => ({
				relationType: a.relationType,
				entity: a.entity,
				permissions: a.permissions || [],
			})));

			setTeams(data.teams || []);
			setClubs(data.clubs || []);
			setStaffTeamTypes(data.staffTeamAssignmentTypes || []);
			setStaffClubTypes(data.staffClubAssignmentTypes || []);
			setFunctionaryTeamTypes(data.functionaryTeamAssignmentTypes || []);
			setFunctionaryClubTypes(data.functionaryClubAssignmentTypes || []);

			setStaffTeamAssignments((data.currentStaffTeamAssignments || []).map((a: any) => ({
				teamId: a.teamId ?? null, clubId: null, typeId: a.typeId ?? null,
				startDate: a.startDate ?? '', endDate: a.endDate ?? '',
			})));
			setStaffClubAssignments((data.currentStaffClubAssignments || []).map((a: any) => ({
				teamId: null, clubId: a.clubId ?? null, typeId: a.typeId ?? null,
				startDate: a.startDate ?? '', endDate: a.endDate ?? '',
			})));
			setFunctionaryTeamAssignments((data.currentFunctionaryTeamAssignments || []).map((a: any) => ({
				teamId: a.teamId ?? null, clubId: null, typeId: a.typeId ?? null,
				startDate: a.startDate ?? '', endDate: a.endDate ?? '',
			})));
			setFunctionaryClubAssignments((data.currentFunctionaryClubAssignments || []).map((a: any) => ({
				teamId: null, clubId: a.clubId ?? null, typeId: a.typeId ?? null,
				startDate: a.startDate ?? '', endDate: a.endDate ?? '',
			})));
		}).finally(() => setLoading(false));
	}, [open, user.id]);

	// ── Spieler / Trainer Handlers ────────────────────────────────────────────

	const handleAdd = (category: 'player' | 'coach') => {
		const firstType = relationTypes.find(rt => rt.category === category) || null;
		const rel: Relation = { relationType: firstType, entity: null, permissions: [] };
		if (category === 'player') setPlayerRelations(prev => [...prev, rel]);
		else setCoachRelations(prev => [...prev, rel]);
	};

	const handleRemove = (category: 'player' | 'coach', idx: number) => {
		if (category === 'player') setPlayerRelations(prev => prev.filter((_, i) => i !== idx));
		else setCoachRelations(prev => prev.filter((_, i) => i !== idx));
	};

	const handleChange = (category: 'player' | 'coach', idx: number, field: keyof Relation, value: any) => {
		const setter = category === 'player' ? setPlayerRelations : setCoachRelations;
		const rels = category === 'player' ? [...playerRelations] : [...coachRelations];
		rels[idx] = { ...rels[idx], [field]: value };
		if (field === 'relationType') rels[idx].entity = null;
		setter(rels);
	};

	const togglePermission = (category: 'player' | 'coach', idx: number, perm: string) => {
		const rels = category === 'player' ? [...playerRelations] : [...coachRelations];
		const current = rels[idx].permissions;
		rels[idx] = {
			...rels[idx],
			permissions: current.includes(perm)
				? current.filter(p => p !== perm)
				: [...current, perm],
		};
		if (category === 'player') setPlayerRelations(rels);
		else setCoachRelations(rels);
	};

	// ── Assignment Handlers (Staff / Funktionäre) ─────────────────────────────

	type AssignmentSetter = React.Dispatch<React.SetStateAction<AssignmentRow[]>>;

	const addAssignment = (setter: AssignmentSetter) => setter(prev => [...prev, emptyAssignment()]);
	const removeAssignment = (setter: AssignmentSetter, idx: number) => setter(prev => prev.filter((_, i) => i !== idx));
	const changeAssignment = (setter: AssignmentSetter, idx: number, field: keyof AssignmentRow, value: any) =>
		setter(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));

	// ── Save ─────────────────────────────────────────────────────────────────

	const handleSave = async () => {
		setSaving(true);
		const allRelations = [
			...playerRelations.map(r => ({ ...r, player: r.entity, coach: null })),
			...coachRelations.map(r => ({ ...r, coach: r.entity, player: null })),
		];
		try {
			const res = await apiJson(`/admin/users/${user.id}/assign`, {
				method: 'POST',
				body: {
					relations: allRelations,
					staffTeamAssignments: staffTeamAssignments.filter(a => a.teamId),
					staffClubAssignments: staffClubAssignments.filter(a => a.clubId),
					functionaryTeamAssignments: functionaryTeamAssignments.filter(a => a.teamId),
					functionaryClubAssignments: functionaryClubAssignments.filter(a => a.clubId),
				},
				headers: { 'Content-Type': 'application/json' },
			});
			if (res && res.status === 'success') {
				showToast(res.message || 'Zuordnungen erfolgreich gespeichert.', 'success');
				onSaved?.();
				onClose();
			} else {
				showToast(res?.message || 'Fehler beim Speichern der Zuordnungen.', 'error');
			}
		} catch (e: any) {
			showToast(e?.message || 'Fehler beim Speichern. Bitte versuche es nochmal.', 'error');
		} finally {
			setSaving(false);
		}
	};

	// ── RelationCard (Spieler / Trainer) ──────────────────────────────────────

	const RelationCard = ({ category, rel, idx }: { category: 'player' | 'coach'; rel: Relation; idx: number }) => {
		const isPlayer = category === 'player';
		const typeOptions = relationTypes.filter(rt => rt.category === category);
		const entityOptions = isPlayer ? players : coaches;
		const entityLabel = isPlayer ? 'Spieler auswählen' : 'Trainer auswählen';

		return (
			<Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, borderColor: isPlayer ? 'primary.light' : 'secondary.light', bgcolor: isPlayer ? 'primary.50' : 'secondary.50', position: 'relative' }}>
				<IconButton size="small" color="error" onClick={() => handleRemove(category, idx)} aria-label="Zuordnung entfernen" sx={{ position: 'absolute', top: 8, right: 8 }}>
					<DeleteOutlineIcon fontSize="small" />
				</IconButton>
				<Stack spacing={2} sx={{ pr: 4 }}>
					<TextField select fullWidth label={isPlayer ? '👨‍👩‍👧 Meine Rolle zu diesem Spieler' : '👋 Meine Rolle zu diesem Trainer'} value={rel.relationType?.id ?? ''}
						onChange={e => handleChange(category, idx, 'relationType', typeOptions.find(rt => rt.id === +e.target.value) || null)}>
						{typeOptions.map(rt => <MenuItem key={rt.id} value={rt.id}>{rt.name}</MenuItem>)}
					</TextField>
					<TextField select fullWidth label={entityLabel} value={rel.entity?.id ?? ''} disabled={!rel.relationType}
						helperText={!rel.relationType ? 'Bitte zuerst die Rolle auswählen' : undefined}
						onChange={e => handleChange(category, idx, 'entity', (isPlayer ? players : coaches).find(p => p.id === +e.target.value) || null)}>
						{entityOptions.map(p => (
							<MenuItem key={p.id} value={p.id}>
								<Box sx={{ lineHeight: 1.3 }}>
									<div>{p.fullName}</div>
									{p.teams && p.teams.length > 0 && (
										<Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{p.teams.join(' · ')}</Box>
									)}
								</Box>
							</MenuItem>
						))}
					</TextField>
					{allPermissions.length > 0 && (
						<Box>
							<Typography variant="body2" gutterBottom sx={{ fontWeight: 600, color: 'text.secondary' }}>
								Was darf {rel.entity ? rel.entity.fullName : 'diese Person'} sehen?
							</Typography>
							<FormGroup>
								<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
									{allPermissions.map(perm => (
										<FormControlLabel key={perm}
											control={<Checkbox checked={rel.permissions.includes(perm)} onChange={() => togglePermission(category, idx, perm)} size="small" />}
											label={<Typography variant="body2">{formatPermission(perm)}</Typography>}
											sx={{ mr: 1, mb: 0.5 }}
										/>
									))}
								</Box>
							</FormGroup>
						</Box>
					)}
				</Stack>
			</Paper>
		);
	};

	// ── AssignmentCard (Staff / Funktionär) ───────────────────────────────────

	const AssignmentCard = ({
		row, idx, setter, kind, types,
	}: {
		row: AssignmentRow;
		idx: number;
		setter: AssignmentSetter;
		kind: 'staffTeam' | 'staffClub' | 'functionaryTeam' | 'functionaryClub';
		types: RefItem[];
	}) => {
		const isTeam = kind === 'staffTeam' || kind === 'functionaryTeam';
		const entityList = isTeam ? teams : clubs;
		const entityLabel = isTeam ? 'Team auswählen' : 'Verein auswählen';
		const entityValue = isTeam ? (row.teamId ?? '') : (row.clubId ?? '');
		const entityField = isTeam ? 'teamId' : 'clubId';
		const accentColor = (kind === 'staffTeam' || kind === 'staffClub') ? '#e65100' : '#1565c0';
		const bgColor = (kind === 'staffTeam' || kind === 'staffClub') ? '#fff8f5' : '#f0f4ff';

		return (
			<Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, borderColor: accentColor + '66', bgcolor: bgColor, position: 'relative' }}>
				<IconButton size="small" color="error" onClick={() => removeAssignment(setter, idx)} aria-label="Zuordnung entfernen" sx={{ position: 'absolute', top: 8, right: 8 }}>
					<DeleteOutlineIcon fontSize="small" />
				</IconButton>
				<Stack spacing={2} sx={{ pr: 4 }}>
					<TextField select fullWidth label={entityLabel} value={entityValue}
						onChange={e => changeAssignment(setter, idx, entityField as keyof AssignmentRow, +e.target.value || null)}>
						{entityList.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
					</TextField>
					<TextField select fullWidth label="Funktion / Rolle (optional)" value={row.typeId ?? ''}
						onChange={e => changeAssignment(setter, idx, 'typeId', e.target.value ? +e.target.value : null)}>
						<MenuItem value="">Keine</MenuItem>
						{types.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
					</TextField>
					<Stack direction="row" spacing={1}>
						<TextField type="date" label="Von" value={row.startDate} fullWidth
							slotProps={{ inputLabel: { shrink: true } }}
							onChange={e => changeAssignment(setter, idx, 'startDate', e.target.value)} />
						<TextField type="date" label="Bis" value={row.endDate} fullWidth
							slotProps={{ inputLabel: { shrink: true } }}
							onChange={e => changeAssignment(setter, idx, 'endDate', e.target.value)} />
					</Stack>
				</Stack>
			</Paper>
		);
	};

	// ── RelationSection (Spieler / Trainer) ───────────────────────────────────

	const RelationSection = ({ category, icon, title, subtitle, relations, emptyText }: {
		category: 'player' | 'coach'; icon: React.ReactNode; title: string;
		subtitle: string; relations: Relation[]; emptyText: string;
	}) => (
		<Box sx={{ mb: 3 }}>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
				{icon}
				<Box>
					<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
					<Typography variant="caption" sx={{ color: 'text.secondary' }}>{subtitle}</Typography>
				</Box>
				{relations.length > 0 && <Chip label={relations.length} size="small" sx={{ ml: 'auto' }} />}
			</Box>
			<Divider sx={{ mb: 2 }} />
			{relations.length === 0
				? <Alert severity="info" sx={{ borderRadius: 3, mb: 2 }}>{emptyText}</Alert>
				: relations.map((rel, idx) => <RelationCard key={idx} category={category} rel={rel} idx={idx} />)}
			<Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleAdd(category)} fullWidth
				sx={{ borderRadius: 3, borderStyle: 'dashed', py: 1.2 }}>
				{category === 'player' ? 'Spieler-Zuordnung hinzufügen' : 'Trainer-Zuordnung hinzufügen'}
			</Button>
		</Box>
	);

	// ── AssignmentSection (Staff / Funktionär) ───────────────────────────────

	const AssignmentSection = ({ setter, kind, icon, title, subtitle, assignments, types, emptyText, addLabel }: {
		setter: AssignmentSetter;
		kind: 'staffTeam' | 'staffClub' | 'functionaryTeam' | 'functionaryClub';
		icon: React.ReactNode; title: string; subtitle: string;
		assignments: AssignmentRow[]; types: RefItem[];
		emptyText: string; addLabel: string;
	}) => (
		<Box sx={{ mb: 3 }}>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
				{icon}
				<Box>
					<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
					<Typography variant="caption" sx={{ color: 'text.secondary' }}>{subtitle}</Typography>
				</Box>
				{assignments.length > 0 && <Chip label={assignments.length} size="small" sx={{ ml: 'auto' }} />}
			</Box>
			<Divider sx={{ mb: 2 }} />
			{assignments.length === 0
				? <Alert severity="info" sx={{ borderRadius: 3, mb: 2 }}>{emptyText}</Alert>
				: assignments.map((row, idx) => (
					<AssignmentCard key={idx} row={row} idx={idx} setter={setter} kind={kind} types={types} />
				))}
			<Button variant="outlined" startIcon={<AddIcon />} onClick={() => addAssignment(setter)} fullWidth
				sx={{ borderRadius: 3, borderStyle: 'dashed', py: 1.2 }}>
				{addLabel}
			</Button>
		</Box>
	);

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<BaseModal
			open={open}
			onClose={onClose}
			maxWidth="sm"
			title={
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
					<PersonAddAlt1Icon color="primary" />
					<Box>
						<Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Zuordnungen verwalten</Typography>
						<Typography variant="caption" sx={{ color: 'text.secondary' }}>{user.fullName}</Typography>
					</Box>
				</Box>
			}
			actions={
				<Stack direction="row" spacing={1.5} sx={{ width: '100%', px: 0.5, pb: 0.5 }}>
					<Button variant="outlined" color="inherit" onClick={onClose} fullWidth sx={{ borderRadius: 3 }} disabled={saving}>Abbrechen</Button>
					<Button variant="contained" color="primary" onClick={handleSave} fullWidth disabled={loading || saving}
						startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined} sx={{ borderRadius: 3 }}>
						{saving ? 'Wird gespeichert…' : 'Speichern'}
					</Button>
				</Stack>
			}
		>
			{loading ? (
				<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6, gap: 2 }}>
					<CircularProgress size={28} />
					<Typography sx={{ color: 'text.secondary' }}>Daten werden geladen…</Typography>
				</Box>
			) : (
				<Box sx={{ pt: 1 }}>
					<Alert severity="info" icon={false} sx={{ mb: 3, borderRadius: 3 }}>
						<Typography variant="body2">
							Hier kannst du alle Rollen und Zuordnungen dieses Benutzers verwalten –
							als Spieler-/Trainer-Bezugsperson, als Staff-Mitglied oder als Vereinsfunktionär.
						</Typography>
					</Alert>

					{/* Spieler */}
					<RelationSection
						category="player"
						icon={<SportsSoccerIcon color="primary" />}
						title="Spieler"
						subtitle="z.B. eigene Kinder im Team"
						relations={playerRelations}
						emptyText="Noch kein Spieler zugeordnet."
					/>

					{/* Trainer */}
					<RelationSection
						category="coach"
						icon={<SportsIcon color="secondary" />}
						title="Trainer"
						subtitle="z.B. Trainer meines Kindes"
						relations={coachRelations}
						emptyText="Noch kein Trainer zugeordnet."
					/>

					{/* Staff – Team */}
					<AssignmentSection
						setter={setStaffTeamAssignments}
						kind="staffTeam"
						icon={<WorkIcon sx={{ color: '#e65100' }} />}
						title="Staff – Teams"
						subtitle="z.B. Physiotherapeut, Zeugwart"
						assignments={staffTeamAssignments}
						types={staffTeamTypes}
						emptyText="Noch kein Team-Staff zugeordnet."
						addLabel="Team-Staff hinzufügen"
					/>

					{/* Staff – Verein */}
					<AssignmentSection
						setter={setStaffClubAssignments}
						kind="staffClub"
						icon={<WorkIcon sx={{ color: '#e65100' }} />}
						title="Staff – Verein"
						subtitle="z.B. Busfahrer, Medienbeauftragter"
						assignments={staffClubAssignments}
						types={staffClubTypes}
						emptyText="Noch kein Vereins-Staff zugeordnet."
						addLabel="Vereins-Staff hinzufügen"
					/>

					{/* Funktionär – Team */}
					<AssignmentSection
						setter={setFunctionaryTeamAssignments}
						kind="functionaryTeam"
						icon={<AccountBalanceIcon sx={{ color: '#1565c0' }} />}
						title="Funktionär – Teams"
						subtitle="z.B. Teamleiter, Jugendbeauftragter"
						assignments={functionaryTeamAssignments}
						types={functionaryTeamTypes}
						emptyText="Noch kein Team-Funktionär zugeordnet."
						addLabel="Team-Funktionär hinzufügen"
					/>

					{/* Funktionär – Verein */}
					<AssignmentSection
						setter={setFunctionaryClubAssignments}
						kind="functionaryClub"
						icon={<AccountBalanceIcon sx={{ color: '#1565c0' }} />}
						title="Funktionär – Verein"
						subtitle="z.B. Vorsitzender, Kassenwart"
						assignments={functionaryClubAssignments}
						types={functionaryClubTypes}
						emptyText="Noch kein Vereins-Funktionär zugeordnet."
						addLabel="Vereins-Funktionär hinzufügen"
					/>
				</Box>
			)}
		</BaseModal>
	);
};

export default UserRelationEditModal;
