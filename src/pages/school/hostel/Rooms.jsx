import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../api';
import { toast } from '../../../toast';
import {
  PageShell, Loading, Empty, Badge, Tabs, Kpi, Modal, statusBadge,
  fmtDate, money, canHostelManage, ROOM_STATUS_TONE, BED_STATUS_TONE, studentName,
} from './shared';

const TABS = [
  ['layout', 'Layout', 'bi-diagram-3'],
  ['rooms', 'Rooms', 'bi-door-open'],
  ['inspections', 'Inspections', 'bi-clipboard-check'],
  ['maintenance', 'Maintenance', 'bi-tools'],
];

const emptyHostel = { name: '', type: 'boys', capacity: 0, phone: '', address: '' };
const emptyBlock = { hostelId: '', name: '' };
const emptyFloor = { blockId: '', name: '', level: 0 };
const emptyRoom = { hostelId: '', blockId: '', floorId: '', number: '', roomType: 'double', capacity: 2, feeCategory: '' };

export default function HostelRooms({ me, onNavigate }) {
  const manage = canHostelManage(me, 'hostel.manage');
  const [tab, setTab] = useState('layout');
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState({ hostels: [], blocks: [], floors: [], rooms: [], beds: [] });
  const [dashboard, setDashboard] = useState({});
  const [rooms, setRooms] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [maintenance, setMaintenance] = useState([]);

  const [hostelForm, setHostelForm] = useState(emptyHostel);
  const [blockForm, setBlockForm] = useState(emptyBlock);
  const [floorForm, setFloorForm] = useState(emptyFloor);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [bulkForm, setBulkForm] = useState({ hostelId: '', blockId: '', floorId: '', fromNumber: '', toNumber: '', capacity: 2, roomType: 'double', prefix: '' });
  const [inspectForm, setInspectForm] = useState({ roomId: '', condition: 'good', findings: '', damageAmount: 0 });
  const [maintForm, setMaintForm] = useState({ roomId: '', issue: '', cost: 0, vendor: '' });
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [l, d, r, i, m] = await Promise.all([
        apiGet('/school/hostel/layout'),
        apiGet('/school/hostel/dashboard'),
        apiGet('/school/hostel/rooms'),
        apiGet('/school/hostel/inspections'),
        apiGet('/school/hostel/maintenance'),
      ]);
      if (l?.ok) setLayout({ hostels: l.hostels || [], blocks: l.blocks || [], floors: l.floors || [], rooms: l.rooms || [], beds: l.beds || [] });
      if (d?.ok) setDashboard(d.summary || {});
      if (r?.ok) setRooms(r.rooms || []);
      if (i?.ok) setInspections(i.inspections || []);
      if (m?.ok) setMaintenance(m.requests || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const summary = dashboard || {};
  const blocksFor = (hostelId) => layout.blocks.filter((b) => String(b.hostel_id) === String(hostelId));
  const floorsFor = (blockId) => layout.floors.filter((f) => String(f.block_id) === String(blockId));
  const bedsFor = (roomId) => layout.beds.filter((b) => String(b.room_id) === String(roomId));

  const roomOptions = useMemo(() => rooms.map((r) => ({
    id: r.id, label: `${r.hostel_name} Ã‚Â· ${r.number} (${r.bed_count} beds)`,
  })), [rooms]);

  async function saveHostel(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/hostels', hostelForm);
      if (res?.ok) { toast('Hostel created', 'success'); setHostelForm(emptyHostel); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function saveBlock(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/blocks', blockForm);
      if (res?.ok) { toast('Block created', 'success'); setBlockForm(emptyBlock); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function saveFloor(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/floors', floorForm);
      if (res?.ok) { toast('Floor created', 'success'); setFloorForm(emptyFloor); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function saveRoom(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/rooms', roomForm);
      if (res?.ok) { toast('Room created with beds', 'success'); setRoomForm({ ...emptyRoom, hostelId: roomForm.hostelId, blockId: roomForm.blockId, floorId: roomForm.floorId }); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function saveBulk(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/rooms/bulk', bulkForm);
      if (res?.ok) { toast(`${res.created} room(s) created`, 'success'); setBulkForm({ ...bulkForm, fromNumber: '', toNumber: '' }); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function setRoomStatus(room, status) {
    try {
      const res = await apiPut(`/school/hostel/rooms/${room.id}/status`, { status });
      if (res?.ok) { toast('Room status updated', 'success'); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function removeRoom(room) {
    if (!window.confirm(`Delete room ${room.number}?`)) return;
    try {
      const res = await apiDelete(`/school/hostel/rooms/${room.id}`);
      if (res?.ok) { toast('Room deleted', 'success'); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function saveInspection(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/inspections', inspectForm);
      if (res?.ok) { toast('Inspection saved', 'success'); setInspectForm({ roomId: '', condition: 'good', findings: '', damageAmount: 0 }); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function saveMaintenance(e) {
    e.preventDefault();
    try {
      const res = await apiPost('/school/hostel/maintenance', maintForm);
      if (res?.ok) { toast('Maintenance raised', 'success'); setMaintForm({ roomId: '', issue: '', cost: 0, vendor: '' }); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function resolveMaintenance(row, status) {
    try {
      const res = await apiPut(`/school/hostel/maintenance/${row.id}`, { status });
      if (res?.ok) { toast('Maintenance updated', 'success'); load(); } else toast(res?.error || 'Failed', 'error');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function openRoom(room) {
    setDetail({ room, loading: true });
    setDetailLoading(true);
    try {
      const res = await apiGet(`/school/hostel/rooms/${room.id}`);
      setDetail(res?.ok ? res : { room });
    } catch (err) {
      toast(err.message, 'error');
      setDetail({ room });
    } finally { setDetailLoading(false); }
  }

  if (loading) return <Loading />;

  return (
    <PageShell title="Hostel Rooms" icon="bi-building" subtitle="Hostels, blocks, floors, rooms and beds" onNavigate={onNavigate}>
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Hostels" value={summary.hostels} icon="bi-building" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Rooms" value={summary.rooms} icon="bi-door-open" tone="info" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Beds" value={summary.beds} icon="bi-layout-three-columns" tone="secondary" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Occupied" value={summary.occupied} icon="bi-person-check" tone="primary" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Vacant" value={summary.vacant} icon="bi-person-dash" tone="success" /></div>
        <div className="col-6 col-md-3 col-xl-2"><Kpi label="Maintenance" value={summary.maintenance} icon="bi-tools" tone="warning" /></div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'layout' && (
        <div className="row g-3">
          <div className="col-xl-4">
            {manage && (
              <>
                <div className="card mb-3"><div className="card-body">
                  <h6 className="mb-2"><i className="bi bi-building-add me-1"></i>New Hostel</h6>
                  <form onSubmit={saveHostel} className="row g-2">
                    <div className="col-8"><input className="form-control form-control-sm" placeholder="Hostel name" value={hostelForm.name} onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })} required /></div>
                    <div className="col-4"><select className="form-select form-select-sm" value={hostelForm.type} onChange={(e) => setHostelForm({ ...hostelForm, type: e.target.value })}><option value="boys">Boys</option><option value="girls">Girls</option><option value="coed">Coed</option></select></div>
                    <div className="col-6"><input className="form-control form-control-sm" placeholder="Phone" value={hostelForm.phone} onChange={(e) => setHostelForm({ ...hostelForm, phone: e.target.value })} /></div>
                    <div className="col-6"><input type="number" className="form-control form-control-sm" placeholder="Capacity" value={hostelForm.capacity} onChange={(e) => setHostelForm({ ...hostelForm, capacity: e.target.value })} /></div>
                    <div className="col-12"><button className="btn btn-sm btn-primary w-100">Add Hostel</button></div>
                  </form>
                </div></div>

                <div className="card mb-3"><div className="card-body">
                  <h6 className="mb-2"><i className="bi bi-diagram-2 me-1"></i>New Block</h6>
                  <form onSubmit={saveBlock} className="row g-2">
                    <div className="col-6"><select className="form-select form-select-sm" value={blockForm.hostelId} onChange={(e) => setBlockForm({ ...blockForm, hostelId: e.target.value })} required><option value="">Hostel</option>{layout.hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                    <div className="col-6"><input className="form-control form-control-sm" placeholder="Block name" value={blockForm.name} onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })} required /></div>
                    <div className="col-12"><button className="btn btn-sm btn-primary w-100">Add Block</button></div>
                  </form>
                </div></div>

                <div className="card mb-3"><div className="card-body">
                  <h6 className="mb-2"><i className="bi bi-layers me-1"></i>New Floor</h6>
                  <form onSubmit={saveFloor} className="row g-2">
                    <div className="col-7"><select className="form-select form-select-sm" value={floorForm.blockId} onChange={(e) => setFloorForm({ ...floorForm, blockId: e.target.value })} required><option value="">Block</option>{layout.blocks.map((b) => <option key={b.id} value={b.id}>{b.hostel_name} Ã‚Â· {b.name}</option>)}</select></div>
                    <div className="col-5"><input className="form-control form-control-sm" placeholder="Floor" value={floorForm.name} onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })} required /></div>
                    <div className="col-12"><button className="btn btn-sm btn-primary w-100">Add Floor</button></div>
                  </form>
                </div></div>

                <div className="card mb-3"><div className="card-body">
                  <h6 className="mb-2"><i className="bi bi-door-open me-1"></i>New Room</h6>
                  <form onSubmit={saveRoom} className="row g-2">
                    <div className="col-12"><select className="form-select form-select-sm" value={roomForm.hostelId} onChange={(e) => setRoomForm({ ...roomForm, hostelId: e.target.value, blockId: '', floorId: '' })} required><option value="">Hostel</option>{layout.hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                    <div className="col-6"><select className="form-select form-select-sm" value={roomForm.blockId} onChange={(e) => setRoomForm({ ...roomForm, blockId: e.target.value, floorId: '' })}><option value="">Block (optional)</option>{blocksFor(roomForm.hostelId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                    <div className="col-6"><select className="form-select form-select-sm" value={roomForm.floorId} onChange={(e) => setRoomForm({ ...roomForm, floorId: e.target.value })}><option value="">Floor (optional)</option>{floorsFor(roomForm.blockId).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
                    <div className="col-4"><input className="form-control form-control-sm" placeholder="Room no." value={roomForm.number} onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })} required /></div>
                    <div className="col-4"><select className="form-select form-select-sm" value={roomForm.roomType} onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}><option value="single">Single</option><option value="double">Double</option><option value="triple">Triple</option><option value="dormitory">Dormitory</option><option value="warden">Warden</option><option value="guest">Guest</option><option value="accessible">Accessible</option></select></div>
                    <div className="col-4"><input type="number" min="1" className="form-control form-control-sm" placeholder="Beds" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} /></div>
                    <div className="col-12"><input className="form-control form-control-sm" placeholder="Fee category (optional)" value={roomForm.feeCategory} onChange={(e) => setRoomForm({ ...roomForm, feeCategory: e.target.value })} /></div>
                    <div className="col-12"><button className="btn btn-sm btn-primary w-100">Add Room + Beds</button></div>
                  </form>
                </div></div>

                <div className="card"><div className="card-body">
                  <h6 className="mb-2"><i className="bi bi-stack me-1"></i>Bulk Create Rooms</h6>
                  <form onSubmit={saveBulk} className="row g-2">
                    <div className="col-12"><select className="form-select form-select-sm" value={bulkForm.hostelId} onChange={(e) => setBulkForm({ ...bulkForm, hostelId: e.target.value, blockId: '', floorId: '' })} required><option value="">Hostel</option>{layout.hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
                    <div className="col-6"><select className="form-select form-select-sm" value={bulkForm.blockId} onChange={(e) => setBulkForm({ ...bulkForm, blockId: e.target.value, floorId: '' })}><option value="">Block</option>{blocksFor(bulkForm.hostelId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                    <div className="col-6"><select className="form-select form-select-sm" value={bulkForm.floorId} onChange={(e) => setBulkForm({ ...bulkForm, floorId: e.target.value })}><option value="">Floor</option>{floorsFor(bulkForm.blockId).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
                    <div className="col-4"><input className="form-control form-control-sm" placeholder="Prefix" value={bulkForm.prefix} onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })} /></div>
                    <div className="col-4"><input type="number" className="form-control form-control-sm" placeholder="From" value={bulkForm.fromNumber} onChange={(e) => setBulkForm({ ...bulkForm, fromNumber: e.target.value })} required /></div>
                    <div className="col-4"><input type="number" className="form-control form-control-sm" placeholder="To" value={bulkForm.toNumber} onChange={(e) => setBulkForm({ ...bulkForm, toNumber: e.target.value })} required /></div>
                    <div className="col-6"><select className="form-select form-select-sm" value={bulkForm.roomType} onChange={(e) => setBulkForm({ ...bulkForm, roomType: e.target.value })}><option value="single">Single</option><option value="double">Double</option><option value="triple">Triple</option><option value="dormitory">Dormitory</option></select></div>
                    <div className="col-6"><input type="number" min="1" className="form-control form-control-sm" placeholder="Beds" value={bulkForm.capacity} onChange={(e) => setBulkForm({ ...bulkForm, capacity: e.target.value })} /></div>
                    <div className="col-12"><button className="btn btn-sm btn-outline-primary w-100">Create Range</button></div>
                  </form>
                </div></div>
              </>
            )}
            {!manage && <div className="alert alert-info py-2 small">You have read-only access to hostel rooms.</div>}
          </div>

          <div className="col-xl-8">
            {layout.hostels.length === 0 ? <Empty icon="bi-building" text="No hostels yet" /> : layout.hostels.map((h) => (
              <div className="card mb-3" key={h.id}>
                <div className="card-header py-2 d-flex justify-content-between align-items-center">
                  <div>
                    <span className="fw-semibold">{h.name}</span>
                    <Badge tone={h.type === 'girls' ? 'danger' : h.type === 'boys' ? 'primary' : 'secondary'}>{h.type}</Badge>
                  </div>
                  <div className="small text-muted">{layout.rooms.filter((r) => r.hostel_id === h.id).length} rooms Ã‚Â· {layout.beds.filter((b) => layout.rooms.some((r) => r.id === b.room_id && r.hostel_id === h.id)).length} beds</div>
                </div>
                <div className="card-body">
                  {blocksFor(h.id).map((b) => (
                    <div key={b.id} className="mb-3">
                      <div className="fw-semibold small mb-2"><i className="bi bi-diagram-2 me-1"></i>{b.name}</div>
                      {floorsFor(b.id).map((f) => (
                        <div key={f.id} className="ms-3 mb-2">
                          <div className="text-muted small mb-1">{f.name}</div>
                          <RoomChips rooms={layout.rooms.filter((r) => r.floor_id === f.id)} bedsFor={bedsFor} onOpen={openRoom} />
                        </div>
                      ))}
                      <div className="ms-3">
                        <RoomChips rooms={layout.rooms.filter((r) => r.block_id === b.id && !r.floor_id)} bedsFor={bedsFor} onOpen={openRoom} />
                      </div>
                    </div>
                  ))}
                  <RoomChips rooms={layout.rooms.filter((r) => r.hostel_id === h.id && !r.block_id)} bedsFor={bedsFor} onOpen={openRoom} />
                  {layout.blocks.length === 0 && layout.rooms.filter((r) => r.hostel_id === h.id).length === 0 && <div className="text-muted small">No blocks or rooms yet.</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'rooms' && (
        <div className="card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle">
                <thead><tr><th>Hostel</th><th>Room</th><th>Type</th><th>Beds</th><th>Occupied</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {rooms.length === 0 && <tr><td colSpan="7"><Empty icon="bi-door-open" text="No rooms" /></td></tr>}
                  {rooms.map((r) => (
                    <tr key={r.id}>
                      <td>{r.hostel_name}</td>
                      <td className="fw-semibold">{r.number}</td>
                      <td className="text-capitalize">{r.room_type}</td>
                      <td>{r.bed_count}</td>
                      <td>{r.occupied}</td>
                      <td>{statusBadge(ROOM_STATUS_TONE, r.status)}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openRoom(r)}>View</button>
                        {manage && (
                          <>
                            <button className="btn btn-sm btn-outline-warning me-1" onClick={() => setRoomStatus(r, r.status === 'maintenance' ? 'available' : 'maintenance')}>{r.status === 'maintenance' ? 'Open' : 'Maintenance'}</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => removeRoom(r)}><i className="bi bi-trash"></i></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'inspections' && (
        <div className="row g-3">
          {manage && (
            <div className="col-lg-4"><div className="card"><div className="card-body">
              <h6>Record Inspection</h6>
              <form onSubmit={saveInspection} className="row g-2">
                <div className="col-12"><select className="form-select form-select-sm" value={inspectForm.roomId} onChange={(e) => setInspectForm({ ...inspectForm, roomId: e.target.value })} required><option value="">Room</option>{roomOptions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
                <div className="col-6"><select className="form-select form-select-sm" value={inspectForm.condition} onChange={(e) => setInspectForm({ ...inspectForm, condition: e.target.value })}><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option></select></div>
                <div className="col-6"><input type="number" className="form-control form-control-sm" placeholder="Damage Ã¢â€šÂ¹" value={inspectForm.damageAmount} onChange={(e) => setInspectForm({ ...inspectForm, damageAmount: e.target.value })} /></div>
                <div className="col-12"><textarea className="form-control form-control-sm" rows="2" placeholder="Findings" value={inspectForm.findings} onChange={(e) => setInspectForm({ ...inspectForm, findings: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-sm btn-primary w-100">Save Inspection</button></div>
              </form>
            </div></div></div>
          )}
          <div className={manage ? 'col-lg-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Recent Inspections</h6>
            <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Date</th><th>Room</th><th>Condition</th><th>Findings</th><th>Damage</th></tr></thead><tbody>
              {inspections.length === 0 && <tr><td colSpan="5"><Empty icon="bi-clipboard" text="No inspections" /></td></tr>}
              {inspections.map((i) => <tr key={i.id}><td>{fmtDate(i.inspection_date)}</td><td>{i.hostel_name} Ã‚Â· {i.room_number}</td><td className="text-capitalize">{i.condition}</td><td>{i.findings || 'Ã¢â‚¬â€'}</td><td>{money(i.damage_amount)}</td></tr>)}
            </tbody></table></div>
          </div></div></div>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="row g-3">
          {manage && (
            <div className="col-lg-4"><div className="card"><div className="card-body">
              <h6>Raise Request</h6>
              <form onSubmit={saveMaintenance} className="row g-2">
                <div className="col-12"><select className="form-select form-select-sm" value={maintForm.roomId} onChange={(e) => setMaintForm({ ...maintForm, roomId: e.target.value })} required><option value="">Room</option>{roomOptions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
                <div className="col-12"><input className="form-control form-control-sm" placeholder="Issue" value={maintForm.issue} onChange={(e) => setMaintForm({ ...maintForm, issue: e.target.value })} required /></div>
                <div className="col-6"><input type="number" className="form-control form-control-sm" placeholder="Cost Ã¢â€šÂ¹" value={maintForm.cost} onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })} /></div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Vendor" value={maintForm.vendor} onChange={(e) => setMaintForm({ ...maintForm, vendor: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-sm btn-primary w-100">Raise Request</button></div>
              </form>
            </div></div></div>
          )}
          <div className={manage ? 'col-lg-8' : 'col-12'}><div className="card"><div className="card-body">
            <h6>Maintenance Requests</h6>
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Room</th><th>Issue</th><th>Status</th><th>Cost</th><th></th></tr></thead><tbody>
              {maintenance.length === 0 && <tr><td colSpan="5"><Empty icon="bi-tools" text="No requests" /></td></tr>}
              {maintenance.map((m) => (
                <tr key={m.id}>
                  <td>{m.hostel_name} Ã‚Â· {m.room_number}</td>
                  <td>{m.issue}<div className="small text-muted">{m.reported_by} Ã‚Â· {fmtDate(m.reported_at)}</div></td>
                  <td><Badge tone={m.status === 'resolved' ? 'success' : m.status === 'in_progress' ? 'warning' : 'secondary'}>{m.status.replace('_', ' ')}</Badge></td>
                  <td>{money(m.cost)}</td>
                  <td className="text-end">{manage && m.status !== 'resolved' && <button className="btn btn-sm btn-outline-success" onClick={() => resolveMaintenance(m, 'resolved')}>Resolve</button>}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div></div></div>
        </div>
      )}

      {detail && (
        <Modal title={`Room ${detail.room?.number || ''}`} onClose={() => setDetail(null)}>
          {detailLoading ? <Loading /> : (
            <>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <Badge tone={ROOM_STATUS_TONE[detail.room?.status] || 'secondary'}>{detail.room?.status}</Badge>
                <span className="small text-muted">{detail.room?.hostel_name} Ã‚Â· {detail.room?.block_name || 'No block'} Ã‚Â· {detail.room?.floor_name || 'No floor'}</span>
                <span className="small text-muted">Capacity {detail.room?.capacity}</span>
              </div>
              <h6 className="small text-uppercase text-muted">Beds</h6>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {(detail.beds || []).map((b) => (
                  <span key={b.id} className={`badge bg-${BED_STATUS_TONE[b.status] || 'secondary'} bg-opacity-75`}>Bed {b.bed_no} Ã‚Â· {b.status}</span>
                ))}
                {(detail.beds || []).length === 0 && <span className="text-muted small">No beds</span>}
              </div>
              <h6 className="small text-uppercase text-muted">Occupants</h6>
              <ul className="list-group list-group-flush mb-3">
                {(detail.occupants || []).map((o) => (
                  <li className="list-group-item px-0 py-1 d-flex justify-content-between" key={o.id}>
                    <span>{studentName(o)} <span className="text-muted small">{o.admission_no}</span></span>
                    <Badge tone={o.status === 'active' ? 'success' : 'warning'}>{o.status}</Badge>
                  </li>
                ))}
                {(detail.occupants || []).length === 0 && <li className="list-group-item px-0 py-1 text-muted small">No occupants</li>}
              </ul>
              {(detail.assets || []).length > 0 && (
                <>
                  <h6 className="small text-uppercase text-muted">Assets</h6>
                  <div className="table-responsive mb-3"><table className="table table-sm"><thead><tr><th>Asset</th><th>Qty</th><th>Condition</th></tr></thead><tbody>
                    {detail.assets.map((a) => <tr key={a.id}><td>{a.asset_name || a.tag_no || `#${a.asset_id || 'Ã¢â‚¬â€'}`}</td><td>{a.quantity}</td><td>{a.condition}</td></tr>)}
                  </tbody></table></div>
                </>
              )}
            </>
          )}
        </Modal>
      )}
    </PageShell>
  );
}

function RoomChips({ rooms, bedsFor, onOpen }) {
  if (!rooms.length) return <span className="text-muted small">No rooms</span>;
  return (
    <div className="d-flex flex-wrap gap-2 mb-2">
      {rooms.map((r) => (
        <button key={r.id} type="button" className="btn btn-sm btn-light border text-start p-2" onClick={() => onOpen(r)} title={`Room ${r.number}`}>
          <div className="fw-semibold small">{r.number}</div>
          <div className="d-flex gap-1 mt-1">
            {bedsFor(r.id).map((b) => (
              <span key={b.id} className={`d-inline-block rounded-circle bg-${BED_STATUS_TONE[b.status] || 'secondary'}`} style={{ width: 8, height: 8 }} title={`Bed ${b.bed_no}: ${b.status}`}></span>
            ))}
            {bedsFor(r.id).length === 0 && <span className="text-muted" style={{ fontSize: 10 }}>no beds</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

