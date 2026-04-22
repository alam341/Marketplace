// Session cache
let _currentUser = null;

async function getCurrentUser() {
  if (_currentUser) return _currentUser;
  const cached = sessionStorage.getItem('currentUser');
  if (cached) { _currentUser = JSON.parse(cached); return _currentUser; }

  const session = await sbGetSession();
  if (!session) return null;

  try {
    const profile = await dbGetProfile(session.user.id);
    _currentUser = { ...profile, email: session.user.email };
    sessionStorage.setItem('currentUser', JSON.stringify(_currentUser));
    return _currentUser;
  } catch {
    return null;
  }
}

async function requireAuth(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) { window.location.href = 'index.html'; return null; }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = 'index.html'; return null;
  }
  return user;
}

function logout() {
  _currentUser = null;
  sessionStorage.clear();
  sbLogout();
}
