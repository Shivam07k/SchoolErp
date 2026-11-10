import React from 'react';
import { PageShell, Empty, canManage } from './shared';

export default function FeeCategories({ me, onNavigate }) {
  const manager = canManage(me);
  return (
    <PageShell
      title="Fee Categories"
      icon="bi-people"
      subtitle="Student categories (New, Old, Staff Ward, Free Seat, etc.)"
      onNavigate={onNavigate}
      actions={
        <button className="btn btn-sm btn-primary" onClick={() => {}}>
          <i className="bi bi-plus-lg me-1"></i>New Category
        </button>
      }
    >
      <Empty icon="bi-people" text="Fee categories management - coming soon" />
    </PageShell>
  );
}
