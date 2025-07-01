// Replace with your actual Dropbox app key
const DROP_CLIENT_ID = 'p2fq8spc502pl5g';
const REDIRECT_URI = 'http://127.0.0.1:3000';
const DROP_SCOPES = 'account_info.read files.metadata.read files.content.read files.content.write';

// Account management
let aaccounts = JSON.parse(localStorage.getItem('dropbox_accounts') || '{}');
let currentdAccountId = localStorage.getItem('current_account_id');
let currentDbx = null;
let currentPath = '';

// DOM elements
const addAccountBtn = document.getElementById('dropbox-add-account-btn');
const daccountsList = document.getElementById('dropbox-accounts-list');
const fileBrowser = document.getElementById('file-browser');
const currentAccountName = document.getElementById('current-account-name');
const uploadBtn = document.getElementById('dropbox-upload-btn');
const fileInput = document.getElementById('dropbox-file-input');
const uploadArea = document.getElementById('upload-area');
const uploadProgress = document.getElementById('upload-progress');
const currentPathEl = document.getElementById('current-path');
const dfileList = document.getElementById('dropbox-file-list');

// Initialize app
Dropboxinit();

function Dropboxinit() {
  // Debug logging
  console.log('Initializing app...');
  console.log('Current URL:', window.location.href);
  console.log('URL Hash:', window.location.hash);
  console.log('Stored accounts:', aaccounts);
  console.log('Current account ID:', currentdAccountId);

  // Check if we're returning from OAuth
  const accessToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');
  console.log('Access token from URL:', accessToken ? 'Found' : 'Not found');

  if (accessToken) {
    handleOAuthReturn(accessToken);
    return;
  }

  renderAccounts();
  if (currentdAccountId && aaccounts[currentdAccountId]) {
    switchDropboxAccount(currentdAccountId);
  }
  setupEventListeners();
}

function setupEventListeners() {
  addAccountBtn.onclick = addAccount;
  uploadBtn.onclick = () => fileInput.click();
  fileInput.onchange = handleFileSelect;

  // Drag and drop
  uploadArea.ondragover = (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  };
  uploadArea.ondragleave = () => {
    uploadArea.classList.remove('dragover');
  };
  uploadArea.ondrop = (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFileSelect({ target: { files: e.dataTransfer.files } });
  };
}

function addAccount() {
  // Add force_reapproval to make Dropbox ask for account selection
  const authUrl = `https://www.dropbox.com/oauth2/authorize?DROP_client_id=${DROP_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(DROP_SCOPES)}&force_reapproval=true`;
  window.location.href = authUrl;
}

async function handleOAuthReturn(accessToken) {
  try {
    console.log('Handling OAuth return with token');
    const dbx = new Dropbox.Dropbox({ accessToken });
    const accountInfo = await dbx.usersGetCurrentAccount();
    const account = accountInfo.result;
    console.log('Account info retrieved:', account);

    const accountId = account.account_id;

    // Check if account already exists
    if (aaccounts[accountId]) {
      showDropboxNotification(`Account ${account.name.display_name} is already connected!`, 'info');
      window.location.hash = '';
      switchDropboxAccount(accountId);
      return;
    }

    aaccounts[accountId] = {
      id: accountId,
      name: account.name.display_name,
      email: account.email,
      accessToken: accessToken,
      addedAt: new Date().toISOString()
    };

    console.log('Saving accounts to localStorage:', aaccounts);
    localStorage.setItem('dropbox_accounts', JSON.stringify(aaccounts));
    currentdAccountId = accountId;
    localStorage.setItem('current_account_id', currentdAccountId);

    // Verify storage
    console.log('Verification - stored accounts:', localStorage.getItem('dropbox_accounts'));
    console.log('Verification - stored current ID:', localStorage.getItem('current_account_id'));

    // Clear the hash
    window.location.hash = '';

    showDropboxNotification(`Account ${account.name.display_name} added successfully!`, 'success');
    renderAccounts();
    switchDropboxAccount(accountId);

  } catch (error) {
    console.error('Error adding account:', error);
    showDropboxNotification(`Failed to add account: ${error.message}`, 'error');
  }
}

function renderAccounts() {
  const accountIds = Object.keys(aaccounts);

  if (accountIds.length === 0) {
    daccountsList.innerHTML = '<div class="no-accounts"><p>No accounts connected. Click "Add Account" to get started.</p></div>';
    return;
  }

  daccountsList.innerHTML = accountIds.map(id => {
    const account = aaccounts[id];
    const isActive = id === currentdAccountId;
    return `
          <div class="account-card ${isActive ? 'active' : ''}" onclick="switchDropboxAccount('${id}')">
            <div class="account-info">
              <div class="account-avatar">${account.name.charAt(0).toUpperCase()}</div>
              <div class="account-details">
                <div class="account-name">${account.name}</div>
                <div class="account-email">${account.email}</div>
              </div>
            </div>
            <div class="account-actions">
              <button class="btn-small btn-remove" onclick="event.stopPropagation(); removeDropboxAccount('${id}')">Remove</button>
            </div>
          </div>
        `;
  }).join('');
}

async function switchDropboxAccount(accountId) {
  try {
    const account = aaccounts[accountId];
    if (!account) return;

    currentdAccountId = accountId;
    localStorage.setItem('current_account_id', currentdAccountId);
    currentDbx = new Dropbox.Dropbox({ accessToken: account.accessToken });

    // Update UI
    renderAccounts();
    currentAccountName.textContent = account.name;
    fileBrowser.classList.add('active');

    // Load root directory
    await listDropboxFiles('');

  } catch (error) {
    console.error('Error switching account:', error);
    showDropboxNotification(`Failed to switch to account: ${error.message}`, 'error');
  }
}

function removeDropboxAccount(accountId) {
  if (confirm('Are you sure you want to remove this account?')) {
    delete aaccounts[accountId];
    localStorage.setItem('dropbox_accounts', JSON.stringify(aaccounts));

    if (currentdAccountId === accountId) {
      currentdAccountId = null;
      currentDbx = null;
      localStorage.removeItem('current_account_id');
      fileBrowser.classList.remove('active');
      currentAccountName.textContent = 'Select an account';
    }

    renderAccounts();
    showDropboxNotification('Account removed successfully!', 'success');
  }
}

async function listDropboxFiles(path) {
  try {
    currentPath = path;
    currentPathEl.textContent = `Current Path: ${path || '/'}`;
    dfileList.innerHTML = '<li class="loading">Loading...</li>';

    const response = await currentDbx.filesListFolder({ path: path });
    const entries = response.result.entries;

    dfileList.innerHTML = '';

    // Add back button if not in root
    if (path !== '') {
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      const backLi = document.createElement('li');
      backLi.className = 'back';
      backLi.innerHTML = '<div class="file-name">.. (Up one level)</div>';
      backLi.onclick = () => listDropboxFiles(parentPath);
      dfileList.appendChild(backLi);
    }

    if (entries.length === 0) {
      dfileList.innerHTML = '<li><div class="file-name">No files or folders found</div></li>';
      return;
    }

    // Sort folders first, then files, alphabetically
    entries.sort((a, b) => {
      if (a['.tag'] === 'folder' && b['.tag'] !== 'folder') return -1;
      if (a['.tag'] !== 'folder' && b['.tag'] === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    entries.forEach(entry => {
      const li = document.createElement('li');
      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = entry.name;

      if (entry['.tag'] === 'folder') {
        li.className = 'folder';
        li.appendChild(fileName);
        li.onclick = () => listDropboxFiles(entry.path_lower);
      } else {
        li.className = 'file';

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        const size = formatFileSize(entry.size);
        const date = new Date(entry.client_modified).toLocaleDateString();
        fileInfo.textContent = `${size} • ${date}`;

        li.appendChild(fileName);
        li.appendChild(fileInfo);
        li.onclick = () => downloadFile(entry.path_display || entry.path_lower, entry.name);
      }

      dfileList.appendChild(li);
    });

  } catch (error) {
    console.error('Error listing files:', error);
    showDropboxNotification(`Error listing files: ${error.message}`, 'error');
  }
}

async function downloadFile(path, filename) {
  try {
    showDropboxNotification(`Downloading ${filename}...`, 'info');

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + aaccounts[currentdAccountId].accessToken,
        'Dropbox-API-Arg': JSON.stringify({ path: path })
      }
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorText = await response.text();
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error_summary || errorText || errorMessage;
      } catch (e) {
        errorMessage = await response.text() || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showDropboxNotification(`${filename} downloaded successfully!`, 'success');

  } catch (error) {
    console.error('Error downloading file:', error);
    showDropboxNotification(`Could not download ${filename}: ${error.message}`, 'error');
  }
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  files.forEach(file => uploadDropboxFile(file));
}

async function uploadDropboxFile(file) {
  try {
    const filename = file.name;
    const uploadPath = currentPath ? `${currentPath}/${filename}` : `/${filename}`;

    // Show upload progress
    uploadProgress.style.display = 'block';
    document.getElementById('upload-filename').textContent = filename;
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('upload-percent').textContent = '0%';

    // For large files, use upload session. For small files, use simple upload
    if (file.size > 150 * 1024 * 1024) { // 150MB
      await uploadLargeFile(file, uploadPath);
    } else {
      await uploadSmallFile(file, uploadPath);
    }

    showDropboxNotification(`${filename} uploaded successfully!`, 'success');

    // Refresh file list
    await listDropboxFiles(currentPath);

  } catch (error) {
    console.error('Error uploading file:', error);
    showDropboxNotification(`Failed to upload ${file.name}: ${error.message}`, 'error');
  } finally {
    uploadProgress.style.display = 'none';
    fileInput.value = ''; // Clear input
  }
}

async function uploadSmallFile(file, uploadPath) {
  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + aaccounts[currentdAccountId].accessToken,
      'Dropbox-API-Arg': JSON.stringify({
        path: uploadPath,
        mode: 'add',
        autorename: true
      }),
      'Content-Type': 'application/octet-stream'
    },
    body: file
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${errorText}`);
  }

  // Simulate progress for small files
  for (let i = 0; i <= 100; i += 10) {
    document.getElementById('progress-fill').style.width = i + '%';
    document.getElementById('upload-percent').textContent = i + '%';
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function uploadLargeFile(file, uploadPath) {
  const chunkSize = 8 * 1024 * 1024; // 8MB chunks
  let offset = 0;
  let sessionId = null;

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    const isLastChunk = offset + chunkSize >= file.size;

    if (offset === 0) {
      // Start session
      const response = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + aaccounts[currentdAccountId].accessToken,
          'Content-Type': 'application/octet-stream'
        },
        body: chunk
      });

      if (!response.ok) throw new Error('Failed to start upload session');
      const result = await response.json();
      sessionId = result.session_id;

    } else if (isLastChunk) {
      // Finish session
      await fetch('https://content.dropboxapi.com/2/files/upload_session/finish', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + aaccounts[currentdAccountId].accessToken,
          'Dropbox-API-Arg': JSON.stringify({
            cursor: { session_id: sessionId, offset: offset },
            commit: { path: uploadPath, mode: 'add', autorename: true }
          }),
          'Content-Type': 'application/octet-stream'
        },
        body: chunk
      });

    } else {
      // Append chunk
      await fetch('https://content.dropboxapi.com/2/files/upload_session/append_v2', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + aaccounts[currentdAccountId].accessToken,
          'Dropbox-API-Arg': JSON.stringify({
            cursor: { session_id: sessionId, offset: offset }
          }),
          'Content-Type': 'application/octet-stream'
        },
        body: chunk
      });
    }

    offset += chunkSize;
    const progress = Math.min(100, Math.round((offset / file.size) * 100));
    document.getElementById('progress-fill').style.width = progress + '%';
    document.getElementById('upload-percent').textContent = progress + '%';
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showDropboxNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 4000);
}