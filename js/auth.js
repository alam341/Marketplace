function login(username, password) {
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return null;
  sessionStorage.setItem('currentUser', JSON.stringify(user));
  return user;
}

function logout() {
  sessionStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

function getCurrentUser() {
  const raw = sessionStorage.getItem('currentUser');
  return raw ? JSON.parse(raw) : null;
}

function requireAuth(allowedRoles) {
  const user = getCurrentUser();
  if (!user) { window.location.href = 'index.html'; return null; }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = 'index.html'; return null;
  }
  return user;
}
