import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User } from '../types';
import LoadingSkeleton from '../components/LoadingSkeleton';

const PER_PAGE = 10;

function formatMemberDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MembersList() {
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      const snap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'member'))
      );
      const data = snap.docs.map(
        (d) => ({ uid: d.id, ...d.data() }) as User
      );
      data.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setMembers(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const term = search.toLowerCase();
    return members.filter(
      (m) =>
        m.displayName.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term)
    );
  }, [members, search]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const start = (page - 1) * PER_PAGE;
  const paged = filtered.slice(start, start + PER_PAGE);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Members</h1>
        <LoadingSkeleton count={5} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Members</h1>

      {members.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <p className="mt-3 text-gray-500">No members registered yet.</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No members match "{search}"</p>
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear search
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Showing {start + 1}–{Math.min(start + PER_PAGE, filtered.length)} of {filtered.length} member{filtered.length !== 1 ? 's' : ''}
              </p>

              <div className="space-y-2">
                {paged.map((member) => (
                  <div
                    key={member.uid}
                    className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">
                          {member.displayName}
                        </p>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            member.notificationsEnabled
                              ? 'bg-green-500'
                              : 'bg-gray-300'
                          }`}
                          title={
                            member.notificationsEnabled
                              ? 'Notifications on'
                              : 'Notifications off'
                          }
                        />
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {member.email}
                      </p>
                    </div>

                    {/* Join date */}
                    <p className="text-xs text-gray-400 shrink-0 hidden sm:block">
                      Joined {formatMemberDate(member.createdAt)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-6">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (n) => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`w-8 h-8 text-sm rounded-lg ${
                          n === page
                            ? 'bg-red-600 text-white'
                            : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
