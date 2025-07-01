  // google ki script
  const GOOGLE_CLIENT_ID = '96271590359-5njli8gciq3t4l181hbi9jn9b5vtund9.apps.googleusercontent.com';
  const API_KEY = 'AIzaSyCH8wZk4l6AZauIF3Wce-QTpQx2Wfe3hEg';

  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';

  // UI Elements
  const addAccountButton = document.getElementById('add_account_button');
  const signoutAllButton = document.getElementById('signout_all_button');

  const uploadSection = document.getElementById('upload_section');
  const uploadButton = document.getElementById('upload_button');
  const filePicker = document.getElementById('file_picker');
  const uploadStatus = document.getElementById('upload_status');

  const fileList = document.getElementById('file_list');
  const dataSection = document.getElementById('data_section');

  const currentUser = document.getElementById('current_user');
  const currentAvatar = document.getElementById('current_avatar');
  const currentName = document.getElementById('current_name');
  const currentEmail = document.getElementById('current_email');

  const accountsList = document.getElementById('accounts_list');
  const noAccounts = document.getElementById('no_accounts');

  // State management with localStorage persistence
  let tokenClient;
  let gapiInited = false;
  let gisInited = false;
  let currentFolderId = 'root';
  let accounts = JSON.parse(localStorage.getItem('google_drive_accounts') || '{}');
  let currentAccountId = localStorage.getItem('current_google_account_id');

  // Initialize app
  function Googleinit() {
    console.log('Initializing Google Drive Manager...');
    console.log('Stored accounts:', accounts);
    console.log('Current account ID:', currentAccountId);

    // Load existing accounts and set current account if available
    if (currentAccountId && accounts[currentAccountId]) {
      console.log('Restoring current account:', accounts[currentAccountId]);
      // Set the token for API calls if available
      if (accounts[currentAccountId].token) {
        gapi.client.setToken({
          access_token: accounts[currentAccountId].token
        });
      }
    }

    updateUI();

    // Try to load files if we have a current account
    if (currentAccountId && accounts[currentAccountId] && gapiInited) {
      listGoogleFiles();
    }
  }

  function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
  }

  async function initializeGapiClient() {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
    Googleinit(); // Initialize after GAPI is ready
  }

  function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: '', // Defined later
    });
    gisInited = true;
    maybeEnableButtons();
  }

  function maybeEnableButtons() {
    if (gapiInited && gisInited) {
      addAccountButton.style.display = 'block';
    }
  }

  addAccountButton.onclick = () => {
    tokenClient.callback = async (resp) => {
      if (resp.error) {
        console.error('Authorization error:', resp.error);
        showGoogleNotification(`Authorization error: ${resp.error}`, 'error');
        return;
      }

      try {
        console.log('OAuth response received');

        // Set the token for this session
        gapi.client.setToken({
          access_token: resp.access_token
        });

        // Get user info
        const userResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${resp.access_token}`);
        const userInfo = await userResponse.json();

        console.log('User info retrieved:', userInfo);

        const accountId = userInfo.id;

        // Check if account already exists
        if (accounts[accountId]) {
          showGoogleNotification(`Account ${userInfo.name} is already connected!`, 'info');
          switchGoogleAccount(accountId);
          return;
        }

        // Store account data
        accounts[accountId] = {
          id: accountId,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          token: resp.access_token,
          addedAt: new Date().toISOString()
        };

        console.log('Saving accounts to localStorage:', accounts);
        localStorage.setItem('google_drive_accounts', JSON.stringify(accounts));

        // Set as current account
        currentAccountId = accountId;
        localStorage.setItem('current_google_account_id', currentAccountId);

        console.log('Verification - stored accounts:', localStorage.getItem('google_drive_accounts'));
        console.log('Verification - stored current ID:', localStorage.getItem('current_google_account_id'));

        showGoogleNotification(`Account ${userInfo.name} added successfully!`, 'success');
        updateUI();
        await listGoogleFiles();

      } catch (error) {
        console.error('Error adding account:', error);
        showGoogleNotification(`Error adding account: ${error.message}`, 'error');
      }
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  signoutAllButton.onclick = () => {
    if (confirm('Are you sure you want to remove all accounts?')) {
      // Revoke all tokens
      Object.values(accounts).forEach(account => {
        if (account.token) {
          google.accounts.oauth2.revoke(account.token, () => { });
        }
      });

      // Clear all data
      accounts = {};
      currentAccountId = null;
      localStorage.removeItem('google_drive_accounts');
      localStorage.removeItem('current_google_account_id');
      gapi.client.setToken(null);

      updateUI();
      fileList.innerHTML = '';
      resetUploadStatus();

      showGoogleNotification('All accounts removed successfully!', 'success');
    }
  };

  function updateUI() {
    const hasAccounts = Object.keys(accounts).length > 0;

    if (hasAccounts) {
      noAccounts.style.display = 'none';
      accountsList.classList.add('active');
      signoutAllButton.style.display = 'inline-block';
      dataSection.classList.add('active');
      uploadSection.classList.add('active');

      // Update current user display
      if (currentAccountId && accounts[currentAccountId]) {
        const account = accounts[currentAccountId];
        currentUser.classList.add('active');
        currentAvatar.src = account.picture;
        currentName.textContent = account.name;
        currentEmail.textContent = account.email;
      }

      // Update accounts list
      updateAccountsList();
    } else {
      noAccounts.style.display = 'block';
      accountsList.classList.remove('active');
      currentUser.classList.remove('active');
      signoutAllButton.style.display = 'none';
      dataSection.classList.remove('active');
    }
  }

  function updateAccountsList() {
    accountsList.innerHTML = '';

    Object.values(accounts).forEach(account => {
      const accountItem = document.createElement('div');
      accountItem.className = `account-item ${account.id === currentAccountId ? 'current' : ''}`;

      accountItem.innerHTML = `
          <img class="user-avatar" src="${account.picture}" alt="${account.name}">
          <span class="account-name">${account.name}</span>
          <span class="remove-account" title="Remove account">×</span>
        `;

      // Switch account on click
      accountItem.addEventListener('click', (e) => {
        if (!e.target.classList.contains('remove-account')) {
          switchGoogleAccount(account.id);
        }
      });

      // Remove account
      const removeBtn = accountItem.querySelector('.remove-account');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeGoogleAccount(account.id);
      });

      accountsList.appendChild(accountItem);
    });
  }

  async function switchGoogleAccount(accountId) {
    if (accounts[accountId]) {
      currentAccountId = accountId;
      localStorage.setItem('current_google_account_id', currentAccountId);

      const account = accounts[accountId];

      // Set the token for API calls
      if (account.token) {
        gapi.client.setToken({
          access_token: account.token
        });
      }

      updateUI();
      await listGoogleFiles();

      showGoogleNotification(`Switched to ${account.name}`, 'info');
    }
  }

  function removeGoogleAccount(accountId) {
    
      if (accounts[accountId]) {
        // Revoke token
        if (accounts[accountId].token) {
          google.accounts.oauth2.revoke(accounts[accountId].token, () => { });
        }

        const accountName = accounts[accountId].name;

        // Remove from accounts
        delete accounts[accountId];
        localStorage.setItem('google_drive_accounts', JSON.stringify(accounts));

        // If this was the current account, switch to another or clear
        if (currentAccountId === accountId) {
          const remainingAccounts = Object.keys(accounts);
          if (remainingAccounts.length > 0) {
            switchGoogleAccount(remainingAccounts[0]);
          } else {
            currentAccountId = null;
            localStorage.removeItem('current_google_account_id');
            gapi.client.setToken(null);
            fileList.innerHTML = '';
          }
        }

        updateUI();
        showGoogleNotification(`Account ${accountName} removed successfully!`, 'success');
      
    }
  }

  // Upload functionality
  uploadButton.onclick = async () => {
    if (!currentAccountId) {
      showUploadStatus('Please select an account first.', 'error');
      return;
    }

    const files = filePicker.files;
    if (!files || files.length === 0) {
      showUploadStatus('Please select at least one file to upload.', 'error');
      return;
    }

    uploadButton.disabled = true;
    showUploadStatus(`Uploading ${files.length} file(s)...`, 'loading');

    try {
      const uploadPromises = Array.from(files).map(file => uploadGoogleFile(file));
      const results = await Promise.all(uploadPromises);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (failCount === 0) {
        showUploadStatus(`Successfully uploaded ${successCount} file(s)!`, 'success');
      } else {
        showUploadStatus(`Uploaded ${successCount} file(s), ${failCount} failed.`, 'error');
      }

      filePicker.value = '';
      await listGoogleFiles();

    } catch (error) {
      console.error('Upload error:', error);
      showUploadStatus('Upload failed. Please try again.', 'error');
    } finally {
      uploadButton.disabled = false;
    }
  };

  async function uploadGoogleFile(file) {
    try {
      const metadata = {
        name: file.name,
        parents: [currentFolderId]
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const token = accounts[currentAccountId].token;
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          },
          body: form
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Uploaded file:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error uploading file:', file.name, error);
      return { success: false, error };
    }
  }

  function showUploadStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = `upload-status ${type}`;
  }

  function resetUploadStatus() {
    uploadStatus.textContent = '';
    uploadStatus.className = 'upload-status';
  }

  // Helper function to create file elements
  function createFileElement(file) {
    const li = document.createElement('li');
    li.classList.add('file-item');
    const link = document.createElement('a');
    link.href = file.webContentLink || file.webViewLink;
    link.target = '_blank';

    const icon = document.createElement('img');
    icon.src = file.iconLink;
    icon.classList.add('file-icon');
    link.appendChild(icon);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = file.name;
    link.appendChild(nameSpan);

    li.appendChild(link);
    return li;
  }

  // Helper function to create folder elements with expand/collapse functionality
  function createFolderElement(folder) {
    const li = document.createElement('li');
    li.classList.add('folder-item');
    li.dataset.folderId = folder.id;

    const folderHeader = document.createElement('div');
    folderHeader.classList.add('folder-header');

    const caret = document.createElement('span');
    caret.classList.add('caret');
    caret.innerHTML = '&#9654;';
    folderHeader.appendChild(caret);

    const icon = document.createElement('img');
    icon.src = folder.iconLink;
    icon.classList.add('file-icon');
    folderHeader.appendChild(icon);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = folder.name;
    folderHeader.appendChild(nameSpan);

    li.appendChild(folderHeader);

    const childrenContainer = document.createElement('ul');
    childrenContainer.classList.add('nested');
    li.appendChild(childrenContainer);

    folderHeader.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isExpanded = li.classList.toggle('expanded');
      caret.innerHTML = isExpanded ? '&#9660;' : '&#9654;';

      if (isExpanded) {
        currentFolderId = folder.id;
      }

      if (isExpanded && childrenContainer.children.length === 0) {
        childrenContainer.innerHTML = '<li>Loading...</li>';
        try {
          const response = await gapi.client.drive.files.list({
            pageSize: 100,
            fields: 'files(id, name, mimeType, webViewLink, webContentLink, parents, iconLink)',
            q: `'${folder.id}' in parents and trashed = false`,
            orderBy: 'folder desc, name'
          });
          const children = response.result.files;
          childrenContainer.innerHTML = '';
          if (children && children.length > 0) {
            children.forEach(child => {
              const element = child.mimeType === 'application/vnd.google-apps.folder'
                ? createFolderElement(child)
                : createFileElement(child);
              childrenContainer.appendChild(element);
            });
          } else {
            childrenContainer.innerHTML = '<li class="empty-folder">This folder is empty.</li>';
          }
        } catch (err) {
          console.error('Error fetching folder contents:', err);
          childrenContainer.innerHTML = '<li>Error loading contents.</li>';
        }
      }
    });
    return li;
  }

  async function listGoogleFiles() {
    if (!currentAccountId) return;

    try {
      fileList.innerHTML = '<li>Loading...</li>';
      const response = await gapi.client.drive.files.list({
        pageSize: 200,
        fields: 'files(id, name, mimeType, webViewLink, webContentLink, parents, iconLink)',
        q: "'root' in parents and trashed = false",
        orderBy: 'folder desc, name'
      });

      const files = response.result.files;
      console.log("Fetched files:", files);
      if (!files || files.length === 0) {
        fileList.innerHTML = '<li>No files found in your Drive.</li>';
        return;
      }

      fileList.innerHTML = '';
      files.forEach(file => {
        const element = file.mimeType === 'application/vnd.google-apps.folder'
          ? createFolderElement(file)
          : createFileElement(file);
        fileList.appendChild(element);
      });

    } catch (err) {
      console.error('Error fetching files:', err);
      fileList.innerHTML = '<li>Error fetching files.</li>';

      // If there's an auth error, the token might be expired
      if (err.status === 401) {
        showGoogleNotification('Session expired. Please re-add your account.', 'error');
        removeGoogleAccount(currentAccountId); // This automates the logout
      }
    }
  }

  function showGoogleNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 4000);
  }

  window.onload = () => {
    gapiLoaded();
    gisLoaded();
  };