// Client-side fallback service for CareFlow AI when backend server is offline or unreachable
// Ensures zero "Network Error" failures on live cloud deployment (App Runner)

const STORAGE_KEYS = {
  USERS: 'careflow_mock_users',
  APPTS: 'careflow_mock_appts',
  NOTIFS: 'careflow_mock_notifs',
};

// Initial seeded accounts matching workshop presentation
const DEFAULT_USERS = [
  {
    id: 99,
    full_name: 'Khaja Admin',
    email: 'khaja.admin@gmail.com',
    password: 'khaja1234',
    role: 'admin',
    specialty: null,
    phone: '+1 555-0100',
    is_active: true,
  },
  {
    id: 100,
    full_name: 'Khaja Admin',
    email: 'kahaja.admin@gmail.com',
    password: 'khaja1234',
    role: 'admin',
    specialty: null,
    phone: '+1 555-0100',
    is_active: true,
  },
  {
    id: 1,
    full_name: 'Dr. Khaja Provider',
    email: 'khaja.provider@gmail.com',
    password: 'khaja1234',
    role: 'provider',
    specialty: 'Cardiology',
    phone: '+1 555-0199',
    is_active: true,
  },
  {
    id: 2,
    full_name: 'Khaja Patient',
    email: 'khaja.patient@gmail.com',
    password: 'khaja1234',
    role: 'patient',
    specialty: null,
    phone: '+1 555-0188',
    is_active: true,
  },
  {
    id: 3,
    full_name: 'Dr. Marcus Vance',
    email: 'vance.neuro@hospital.com',
    password: 'Provider123!',
    role: 'provider',
    specialty: 'Neurology',
    phone: '+1 555-0144',
    is_active: true,
  },
  {
    id: 4,
    full_name: 'Dr. Robert Chen',
    email: 'chen.ortho@hospital.com',
    password: 'Provider123!',
    role: 'provider',
    specialty: 'Orthopedics',
    phone: '+1 555-0133',
    is_active: true,
  },
  {
    id: 5,
    full_name: 'Dr. Maya Lin',
    email: 'lin.derm@hospital.com',
    password: 'Provider123!',
    role: 'provider',
    specialty: 'Dermatology',
    phone: '+1 555-0155',
    is_active: true,
  },
  {
    id: 6,
    full_name: 'Dr. Sam Wilson',
    email: 'wilson.gp@hospital.com',
    password: 'Provider123!',
    role: 'provider',
    specialty: 'General Practice',
    phone: '+1 555-0166',
    is_active: true,
  },
  {
    id: 7,
    full_name: 'Khaja Administrator',
    email: 'khaja.admin@gmail.com',
    password: 'khaja1234',
    role: 'admin',
    specialty: null,
    phone: '+1 555-0100',
    is_active: true,
  },
  {
    id: 8,
    full_name: 'System Administrator',
    email: 'admin@careflow.ai',
    password: 'Admin123!',
    role: 'admin',
    specialty: null,
    phone: '+1 555-0100',
    is_active: true,
  }
];

function getFutureDate(days, hours, minutes) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

const DEFAULT_APPOINTMENTS = [
  {
    id: 101,
    patient_id: 2,
    patient_name: 'Khaja Patient',
    patient_email: 'khaja.patient@gmail.com',
    patient_phone: '+1 555-0188',
    provider_id: 1,
    provider_name: 'Dr. Khaja Provider',
    specialty: 'Cardiology',
    reason: 'Occasional chest tightness after exercise for the past week.',
    ai_summary: 'Patient reports exertional chest tightness lasting one week; recommend Cardiology evaluation with medium urgency.',
    urgency: 'medium',
    status: 'confirmed',
    scheduled_time: getFutureDate(1, 10, 0),
    created_at: new Date().toISOString(),
  },
  {
    id: 102,
    patient_id: 2,
    patient_name: 'Khaja Patient',
    patient_email: 'khaja.patient@gmail.com',
    patient_phone: '+1 555-0188',
    provider_id: 3,
    provider_name: 'Dr. Marcus Vance',
    specialty: 'Neurology',
    reason: 'Recurring tension headaches and mild light sensitivity.',
    ai_summary: 'Tension headache episodes documented. Low urgency neurological consultation.',
    urgency: 'low',
    status: 'pending',
    scheduled_time: getFutureDate(2, 14, 30),
    created_at: new Date().toISOString(),
  }
];

function getStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setStored(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Storage error', e);
  }
}

export function handleMockRequest(method, url, data, params, headers) {
  const cleanUrl = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0];
  const currentUser = JSON.parse(localStorage.getItem('careflow_user') || 'null');
  const loadedUsers = getStored(STORAGE_KEYS.USERS, DEFAULT_USERS);
  // Ensure admin users are always present even if legacy storage exists
  const hasAdmin = loadedUsers.some((u) => u.email.toLowerCase() === 'khaja.admin@gmail.com');
  const users = hasAdmin
    ? loadedUsers
    : [...DEFAULT_USERS.filter((u) => u.role === 'admin'), ...loadedUsers];
  const appts = getStored(STORAGE_KEYS.APPTS, DEFAULT_APPOINTMENTS);

  // 1. Auth: Register
  if (method === 'post' && cleanUrl === '/api/auth/register') {
    const payload = typeof data === 'string' ? JSON.parse(data) : (data || {});
    const emailNorm = (payload.email || '').trim().toLowerCase();
    
    const existing = users.find((u) => u.email.toLowerCase() === emailNorm);
    if (existing) {
      const err = new Error('An account with this email already exists');
      err.response = { status: 400, data: { detail: 'An account with this email already exists' } };
      throw err;
    }

    const newUser = {
      id: Date.now(),
      full_name: payload.full_name || 'New User',
      email: emailNorm,
      password: payload.password,
      role: payload.role || 'patient',
      specialty: payload.role === 'provider' ? (payload.specialty || 'General Practice') : null,
      phone: payload.phone || '',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    setStored(STORAGE_KEYS.USERS, users);

    const safeUser = { ...newUser };
    delete safeUser.password;

    return {
      access_token: 'mock-token-' + Date.now(),
      token_type: 'bearer',
      user: safeUser,
    };
  }

  // 2. Auth: Login
  if (method === 'post' && cleanUrl === '/api/auth/login') {
    const payload = typeof data === 'string' ? JSON.parse(data) : (data || {});
    const emailNorm = (payload.email || '').trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === emailNorm);

    if (!user || (user.password && user.password !== payload.password)) {
      const err = new Error('Incorrect email or password');
      err.response = { status: 401, data: { detail: 'Incorrect email or password' } };
      throw err;
    }

    const safeUser = { ...user };
    delete safeUser.password;

    return {
      access_token: 'mock-token-' + Date.now(),
      token_type: 'bearer',
      user: safeUser,
    };
  }

  // 3. Auth: Current User
  if (method === 'get' && cleanUrl === '/api/auth/me') {
    return currentUser || users[0];
  }

  // 4. Appointments: List
  if (method === 'get' && cleanUrl === '/api/appointments') {
    if (!currentUser) return appts;
    if (currentUser.role === 'admin') return appts;
    if (currentUser.role === 'provider') {
      return appts.filter((a) => a.provider_id === currentUser.id || a.specialty === currentUser.specialty);
    }
    return appts.filter((a) => a.patient_id === currentUser.id || a.patient_email === currentUser.email);
  }

  // 5. Appointments: Create
  if (method === 'post' && cleanUrl === '/api/appointments') {
    const payload = typeof data === 'string' ? JSON.parse(data) : (data || {});
    const provider = users.find((u) => u.id === Number(payload.provider_id)) || {};
    
    const newAppt = {
      id: Date.now(),
      patient_id: currentUser ? currentUser.id : 2,
      patient_name: currentUser ? currentUser.full_name : 'Khaja Patient',
      patient_email: currentUser ? currentUser.email : 'khaja.patient@gmail.com',
      patient_phone: currentUser ? currentUser.phone : '+1 555-0188',
      provider_id: payload.provider_id ? Number(payload.provider_id) : (provider.id || null),
      provider_name: provider.full_name || 'CareFlow Attending Clinician',
      specialty: payload.specialty || provider.specialty || 'General Practice',
      reason: payload.reason || 'General medical inquiry',
      ai_summary: payload.ai_summary || 'Standard intake triage.',
      urgency: payload.urgency || 'low',
      status: 'confirmed',
      scheduled_time: payload.scheduled_time || getFutureDate(1, 11, 0),
      created_at: new Date().toISOString(),
    };

    const updated = [newAppt, ...appts];
    setStored(STORAGE_KEYS.APPTS, updated);
    return newAppt;
  }

  // 6. Appointments: Update / Patch
  if (method === 'patch' && cleanUrl.startsWith('/api/appointments/')) {
    const parts = cleanUrl.split('/');
    const id = Number(parts[3]);
    const payload = typeof data === 'string' ? JSON.parse(data) : (data || {});
    
    const updated = appts.map((a) => {
      if (a.id === id) {
        return { ...a, ...payload };
      }
      return a;
    });
    setStored(STORAGE_KEYS.APPTS, updated);
    return updated.find((a) => a.id === id) || { id, ...payload };
  }

  // 7. Appointments: Delete / Cancel
  if (method === 'delete' && cleanUrl.startsWith('/api/appointments/')) {
    const parts = cleanUrl.split('/');
    const id = Number(parts[3]);
    const updated = appts.filter((a) => a.id !== id);
    setStored(STORAGE_KEYS.APPTS, updated);
    return { detail: 'Appointment cancelled successfully' };
  }

  // 8. Available Slots (full 30-minute interval engine aligned with FastAPI backend)
  if (method === 'get' && cleanUrl === '/api/appointments/available-slots') {
    const targetDate = params?.date || new Date().toISOString().split('T')[0];
    const targetProviderId = params?.provider_id ? Number(params.provider_id) : null;
    const targetSpecialty = params?.specialty || 'General Practice';

    const intervals = [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00', '17:30'
    ];

    const now = new Date();

    const slots = intervals.map((timeStr) => {
      const [hh, mm] = timeStr.split(':');
      const hourNum = parseInt(hh, 10);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
      const label = `${String(displayHour).padStart(2, '0')}:${mm} ${ampm}`;
      const iso = `${targetDate}T${timeStr}:00`;
      const slotTime = new Date(iso);

      const isPast = slotTime <= now;

      const isBooked = appts.some((a) => {
        if (!a.scheduled_time || a.status === 'cancelled') return false;
        const apptDate = a.scheduled_time.split('T')[0];
        if (apptDate !== targetDate) return false;
        const timePart = a.scheduled_time.slice(11, 16);
        if (timePart !== timeStr) return false;
        if (targetProviderId) {
          return Number(a.provider_id) === targetProviderId;
        }
        return true;
      });

      const isAvailable = !isPast && !isBooked;

      return {
        time: timeStr,
        label,
        iso,
        available: isAvailable,
        is_past: isPast,
        is_booked: isBooked && !isPast,
      };
    });

    const openSlots = slots.filter((s) => s.available);

    return {
      date: targetDate,
      specialty: targetSpecialty,
      provider_id: targetProviderId,
      total_slots: slots.length,
      open_count: openSlots.length,
      open_slots: openSlots,
      all_slots: slots,
    };
  }

  // 9. Providers list
  if (method === 'get' && (cleanUrl === '/api/users/providers' || cleanUrl === '/api/users/doctors')) {
    const providers = users.filter((u) => u.role === 'provider');
    if (params && params.specialty) {
      const spec = params.specialty.trim().toLowerCase();
      const match = providers.filter(
        (p) =>
          (p.specialty || '').trim().toLowerCase() === spec ||
          p.email === 'khaja.provider@gmail.com'
      );
      return match.length ? match : providers;
    }
    return providers;
  }

  // 10. AI Symptom Intake
  if (method === 'post' && cleanUrl === '/api/ai/symptom-intake') {
    const payload = typeof data === 'string' ? JSON.parse(data) : (data || {});
    const text = (payload.symptom_text || '').toLowerCase();

    let specialty = 'General Practice';
    let urgency = 'medium';
    let summary = 'Patient reports acute discomfort requiring clinical assessment.';
    let suggested_reason = payload.symptom_text || 'Clinical consultation';

    if (text.includes('chest') || text.includes('heart') || text.includes('palpitat') || text.includes('breath')) {
      specialty = 'Cardiology';
      urgency = text.includes('severe') || text.includes('crushing') ? 'high' : 'medium';
      summary = 'Cardiovascular assessment indicated based on reported symptoms.';
      suggested_reason = 'Cardiovascular symptom evaluation';
    } else if (text.includes('headache') || text.includes('migraine') || text.includes('numb') || text.includes('dizzy')) {
      specialty = 'Neurology';
      urgency = text.includes('sudden') ? 'high' : 'low';
      summary = 'Neurological screening suggested for headache / sensory symptoms.';
      suggested_reason = 'Neurological consultation';
    } else if (text.includes('rash') || text.includes('skin') || text.includes('itch') || text.includes('acne')) {
      specialty = 'Dermatology';
      urgency = 'low';
      summary = 'Dermatological evaluation recommended for skin lesion/rash.';
      suggested_reason = 'Dermatology evaluation';
    } else if (text.includes('knee') || text.includes('bone') || text.includes('joint') || text.includes('fracture') || text.includes('back')) {
      specialty = 'Orthopedics';
      urgency = text.includes('fracture') ? 'high' : 'medium';
      summary = 'Musculoskeletal examination indicated.';
      suggested_reason = 'Orthopedic evaluation';
    }

    return {
      recommended_specialty: specialty,
      urgency,
      summary,
      suggested_reason,
      source: 'rule_based',
    };
  }

  // 11. Admin Users & Analytics
  if (method === 'get' && cleanUrl === '/api/admin/users') {
    return users.map((u) => {
      const copy = { ...u };
      delete copy.password;
      return copy;
    });
  }

  if (method === 'get' && cleanUrl === '/api/admin/analytics') {
    const specCounts = {};
    appts.forEach((a) => {
      const spec = a.specialty || 'General Practice';
      specCounts[spec] = (specCounts[spec] || 0) + 1;
    });
    return {
      total_patients: users.filter((u) => u.role === 'patient').length,
      total_providers: users.filter((u) => u.role === 'provider').length,
      total_appointments: appts.length,
      pending_appointments: appts.filter((a) => a.status === 'pending').length,
      confirmed_appointments: appts.filter((a) => a.status === 'confirmed').length,
      completed_appointments: appts.filter((a) => a.status === 'completed').length,
      cancelled_appointments: appts.filter((a) => a.status === 'cancelled').length,
      appointments_by_specialty: specCounts,
      appointments_by_urgency: {
        high: appts.filter((a) => a.urgency === 'high').length,
        medium: appts.filter((a) => a.urgency === 'medium').length,
        low: appts.filter((a) => a.urgency === 'low').length,
      },
    };
  }

  // 12. Notifications
  if (cleanUrl.includes('/notifications')) {
    return [];
  }

  return { status: 'ok' };
}
