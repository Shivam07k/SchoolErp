import React, { useEffect, useState } from 'react';
import { PageShell, Empty, Loading, Badge, fmtDate } from './shared';
import { apiGet, apiPost } from '../../../api';
import { toast } from '../../../toast';

export default function Counter() {
  const [member, setMember] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [copySearch, setCopySearch] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [copyResults, setCopyResults] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member?.id) loadLoans();
  }, [member]);

  async function searchMembers() {
    if (!memberSearch.trim()) return;
    const d = await apiGet(`/school/library/members?q=${encodeURIComponent(memberSearch)}`);
    if (d?.ok) setMemberResults(d.members || []);
  }

  async function searchCopies() {
    if (!copySearch.trim()) return;
    const d = await apiGet(`/school/library/copies?q=${encodeURIComponent(copySearch)}`);
    if (d?.ok) setCopyResults(d.copies || []);
  }

  function selectMember(m) {
    setMember(m);
    setMemberSearch('');
    setMemberResults([]);
    loadLoans();
  }

  async function loadLoans() {
    if (!member?.id) return;
    const d = await apiGet(`/school/library/loans?memberId=${member.id}`);
    if (d?.ok) setLoans(d.loans || []);
  }

  async function issueBook(copyId) {
    if (!member?.id) return toast('Select a member first', 'error');
    const res = await apiPost('/school/library/loans/issue', { copyId, memberId: member.id });
    if (res?.ok) {
      toast('Book issued', 'success');
      loadLoans();
      setCopySearch('');
      setCopyResults([]);
    } else toast(res?.error || 'Issue failed', 'error');
  }

  async function returnBook(loanId) {
    const res = await apiPost('/school/library/loans/return', { loanId });
    if (res?.ok) { toast('Book returned', 'success'); loadLoans(); }
    else toast(res?.error || 'Return failed', 'error');
  }

  async function renewBook(loanId) {
    const res = await apiPost('/school/library/loans/renew', { loanId });
    if (res?.ok) { toast('Renewed', 'success'); loadLoans(); }
    else toast(res?.error || 'Renew failed', 'error');
  }

  return (
    <PageShell title="Issue / Return" icon="bi-arrow-left-right">
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Member Search</label>
          <div className="input-group">
            <input className="form-control form-control-sm" placeholder="Search name, admission no..." value={memberSearch} onChange={e => { setMemberSearch(e.target.value); if (e.target.value.length > 2) searchMembers(); }} />
            <button className="btn btn-outline-secondary" type="button" onClick={searchMembers}><i className="bi bi-search"></i></button>
          </div>
          {memberResults.length > 0 && (
            <div className="dropdown-menu show w-100 mt-1" style={{maxHeight:200, overflow:'auto'}}>
              {memberResults.map(m => (
                <div key={m.id} className="dropdown-item" onClick={() => selectMember(m)}>
                  <strong>{m.name}</strong><br/>
                  <small className="text-muted">{m.member_type} Ã‚Â· {m.member_ref_id || m.id}</small>
                </div>
              ))}
            </div>
          )}
          {member && (
            <div className="alert alert-success mt-2 py-2 mb-0">
              <strong>{member.name}</strong> ({member.member_type})<br/>
              <small className="text-muted">ID: {member.id}</small>
              <button className="btn btn-sm btn-link p-0 ms-2" onClick={() => setMember(null)}>Change</button>
            </div>
          )}
        </div>

        <div className="col-md-4">
          <label className="form-label">Copy Search (Barcode/Title)</label>
          <div className="input-group">
            <input className="form-control form-control-sm" placeholder="Scan barcode or search title..." value={copySearch} onChange={e => { setCopySearch(e.target.value); if (e.target.value.length > 2) searchCopies(); }} />
            <button className="btn btn-outline-secondary" type="button" onClick={searchCopies}><i className="bi bi-search"></i></button>
          </div>
          {copyResults.length > 0 && (
            <div className="dropdown-menu show w-100 mt-1" style={{maxHeight:200, overflow:'auto'}}>
              {copyResults.map(c => (
                <div key={c.id} className="dropdown-item" onClick={() => issueBook(c.id)}>
                  <strong>{c.title || 'Ã¢â‚¬â€'}</strong><br/>
                  <small className="text-muted">Barcode: {c.barcode || 'Ã¢â‚¬â€'} Ã‚Â· {c.status}</small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-md-4">
          <label className="form-label">Quick Actions</label>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-sm btn-success" disabled={!member?.id}><i className="bi bi-arrow-right"></i> Issue</button>
            <button className="btn btn-sm btn-warning"><i className="bi bi-arrow-left"></i> Return</button>
            <button className="btn btn-sm btn-info"><i className="bi bi-arrow-clockwise"></i> Renew</button>
          </div>
        </div>
      </div>

      {member && <div className="mb-3">
        <h6>Current Loans ({loans.length})</h6>
        <div className="school-table-wrap">
          <table className="table table-sm school-table">
            <thead><tr><th>Title</th><th>Barcode</th><th>Issued</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loans.length === 0 ? <tr><td colSpan="6"><Empty text="No active loans" /></td></tr> :
              loans.map(l => (
                <tr key={l.id}>
                  <td>{l.title || 'Ã¢â‚¬â€'}</td>
                  <td><code>{l.barcode || 'Ã¢â‚¬â€'}</code></td>
                  <td>{fmtDate(l.issued_at)}</td>
                  <td>{fmtDate(l.due_at)}</td>
                  <td><Badge status={l.status}>{l.status}</Badge></td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-warning me-1" onClick={() => renewBook(l.id)} disabled={l.status!=='active'}><i className="bi bi-arrow-clockwise"></i></button>
                    <button className="btn btn-sm btn-outline-success" onClick={() => returnBook(l.id)} disabled={l.status!=='active'}><i className="bi bi-arrow-return-left"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </PageShell>
  );
}
