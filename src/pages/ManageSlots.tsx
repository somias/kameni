import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { dayNames } from '../lib/utils';
import type { Slot } from '../types';

const DEFAULT_LOCATION = 'Gym';

const defaultSlot = {
  dayOfWeek: 1,
  startTime: '18:00',
  endTime: '19:00',
  maxCapacity: 15,
};

export default function ManageSlots() {
  const { addToast } = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultSlot);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadSlots = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'slots'));
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Slot))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
      setSlots(items);
    } catch (err) {
      console.error('Error loading slots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await updateDoc(doc(db, 'slots', editingId), {
          dayOfWeek: form.dayOfWeek,
          startTime: form.startTime,
          endTime: form.endTime,
          location: DEFAULT_LOCATION,
          maxCapacity: form.maxCapacity,
        });
        addToast('Slot updated', 'success');
      } else {
        await addDoc(collection(db, 'slots'), {
          ...form,
          location: DEFAULT_LOCATION,
          active: true,
          createdAt: new Date().toISOString(),
        });
        addToast('Slot created', 'success');
      }
      setForm(defaultSlot);
      setShowForm(false);
      setEditingId(null);
      await loadSlots();
    } catch {
      addToast('Failed to save slot', 'error');
    }
  };

  const handleEdit = (slot: Slot) => {
    setForm({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxCapacity: slot.maxCapacity,
    });
    setEditingId(slot.id);
    setShowForm(true);
  };

  const handleToggleActive = async (slot: Slot) => {
    try {
      await updateDoc(doc(db, 'slots', slot.id), { active: !slot.active });
      await loadSlots();
      addToast(slot.active ? 'Slot deactivated' : 'Slot activated', 'info');
    } catch {
      addToast('Failed to update slot', 'error');
    }
  };

  // Group slots by day
  const slotsByDay: Record<number, Slot[]> = {};
  for (const slot of slots) {
    if (!slotsByDay[slot.dayOfWeek]) slotsByDay[slot.dayOfWeek] = [];
    slotsByDay[slot.dayOfWeek].push(slot);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Manage Slots</h1>
        <button
          onClick={() => {
            setForm(defaultSlot);
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Slot'}
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">
            {editingId ? 'Edit Slot' : 'New Slot'}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
              <select
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {dayNames.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Capacity</label>
              <input
                type="number"
                min={1}
                value={form.maxCapacity}
                onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            {editingId ? 'Save Changes' : 'Create Slot'}
          </button>
        </div>
      )}

      {/* Slots list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No slots yet</p>
          <p className="text-sm mt-1">Add your first recurring time slot</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const daySlots = slotsByDay[day];
            if (!daySlots || daySlots.length === 0) return null;

            return (
              <div key={day}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {dayNames[day]}
                </h2>
                <div className="space-y-2">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`bg-white rounded-xl border p-4 flex items-center justify-between ${
                        slot.active ? 'border-gray-200' : 'border-gray-200 opacity-50'
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          {slot.startTime} – {slot.endTime}
                        </p>
                        <p className="text-sm text-gray-500">
                          {slot.maxCapacity} spots
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(slot)}
                          className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(slot)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                            slot.active
                              ? 'text-red-600 border border-red-200 hover:bg-red-50'
                              : 'text-green-600 border border-green-200 hover:bg-green-50'
                          }`}
                        >
                          {slot.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
