document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dom = {
        lockScreen: document.getElementById('lock-screen'),
        appContent: document.getElementById('app-content'),
        lockTitle: document.getElementById('lock-title'),
        lockSubtitle: document.getElementById('lock-subtitle'),
        masterPasswordInput: document.getElementById('master-password-input'),
        masterPasswordConfirm: document.getElementById('master-password-confirm'),
        masterPasswordSubmit: document.getElementById('master-password-submit'),
        lockError: document.getElementById('lock-error'),
        passwordOutput: document.getElementById('generated-password-output'),
        lengthSlider: document.getElementById('length-slider'),
        lengthDisplay: document.getElementById('length-display'),
        includeUppercase: document.getElementById('include-uppercase'),
        includeLowercase: document.getElementById('include-lowercase'),
        includeNumbers: document.getElementById('include-numbers'),
        includeSymbols: document.getElementById('include-symbols'),
        excludeAmbiguous: document.getElementById('exclude-ambiguous'),
        regenerateBtn: document.getElementById('regenerate-btn'),
        copyPasswordBtn: document.getElementById('copy-password-btn'),
        strengthBar: document.getElementById('strength-bar'),
        entryWebsite: document.getElementById('entry-website'),
        entryUsername: document.getElementById('entry-username'),
        saveEntryBtn: document.getElementById('save-entry-btn'),
        vaultList: document.getElementById('vault-list'),
        searchVaultInput: document.getElementById('search-vault-input'),
        lockVaultBtn: document.getElementById('lock-vault-btn'),
        exportVaultBtn: document.getElementById('export-vault-btn'),
        importVaultBtn: document.getElementById('import-vault-btn'),
        importFileInput: document.getElementById('import-file-input'),
    };

    // --- State ---
    let vaultItems = [];
    let masterPassword = null;
    const db = localforage.createInstance({ name: 'lightSecureVault' });

    // --- Crypto Functions ---
    const encrypt = (text, key) => CryptoJS.AES.encrypt(text, key).toString();
    const decrypt = (ciphertext, key) => {
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, key);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            // If decryption results in an empty string, it's likely a failure
            if (decrypted) {
                return decrypted;
            }
            return null;
        } catch { return null; }
    };

    // --- App Logic ---
    async function init() {
        const check = await db.getItem('vault_check');
        if (check) {
            dom.lockTitle.textContent = '解锁保险库';
            dom.lockSubtitle.textContent = '请输入您的主密码以继续。';
            dom.masterPasswordConfirm.classList.add('hidden');
            dom.masterPasswordSubmit.textContent = '解锁';
        } else {
            dom.masterPasswordConfirm.classList.remove('hidden');
        }
        dom.lockScreen.classList.remove('hidden');
        dom.appContent.classList.add('hidden');
        dom.masterPasswordInput.focus();
    }

    async function handleMasterPasswordSubmit() {
        const pass = dom.masterPasswordInput.value;
        const confirmPass = dom.masterPasswordConfirm.value;
        const check = await db.getItem('vault_check');

        dom.lockError.textContent = '';
        if (!pass) {
            dom.lockError.textContent = '主密码不能为空。';
            return;
        }

        if (check) { // Unlock Mode
            const decryptedCheck = decrypt(check, pass);
            if (decryptedCheck === 'ok') {
                masterPassword = pass;
                vaultItems = (await db.getItem('vault_items')) || [];
                dom.lockScreen.classList.add('hidden');
                dom.appContent.classList.remove('hidden');
                renderVault();
                generatePassword();
            } else {
                dom.lockError.textContent = '主密码错误。';
            }
        } else { // Setup Mode
            if (pass !== confirmPass) {
                dom.lockError.textContent = '两次输入的密码不匹配。';
                return;
            }
            const encryptedCheck = encrypt('ok', pass);
            await db.setItem('vault_check', encryptedCheck);
            await db.setItem('vault_items', []);
            masterPassword = pass;
            vaultItems = [];
            dom.lockScreen.classList.add('hidden');
            dom.appContent.classList.remove('hidden');
            renderVault();
            generatePassword();
        }
    }

    // --- Password Generator ---
    function generatePassword() {
        const length = dom.lengthSlider.value;
        const chars = {
            upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            lower: 'abcdefghijklmnopqrstuvwxyz',
            numbers: '0123456789',
            symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
        };
        const ambiguous = 'iIl1oO0';
        let charSet = '';
        if (dom.includeUppercase.checked) charSet += chars.upper;
        if (dom.includeLowercase.checked) charSet += chars.lower;
        if (dom.includeNumbers.checked) charSet += chars.numbers;
        if (dom.includeSymbols.checked) charSet += chars.symbols;
        if (dom.excludeAmbiguous.checked) charSet = charSet.split('').filter(c => !ambiguous.includes(c)).join('');
        if (!charSet) { dom.passwordOutput.value = ''; updateStrengthMeter(''); return; }

        let password = '';
        const randomValues = new Uint32Array(length);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            password += charSet[randomValues[i] % charSet.length];
        }
        dom.passwordOutput.value = password;
        updateStrengthMeter(password);
    }
    
    function updateStrengthMeter(password) {
        let score = 0;
        if (!password) { dom.strengthBar.style.width = '0%'; return; }
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (password.length >= 16) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 2;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        
        const width = (score / 7) * 100;
        let color = 'var(--strength-weak)';
        if (score > 2) color = 'var(--strength-medium)';
        if (score > 4) color = 'var(--strength-strong)';
        if (score > 6) color = 'var(--strength-very-strong)';
        dom.strengthBar.style.width = `${width}%`;
        dom.strengthBar.style.backgroundColor = color;
    }

    // --- Vault Management ---
    async function saveEntry() {
        const website = dom.entryWebsite.value.trim();
        const username = dom.entryUsername.value.trim();
        const password = dom.passwordOutput.value;
        if (!website || !username || !password || password === '请至少选择一种字符集') {
            alert('网站、用户名和生成的密码不能为空。');
            return;
        }
        const encryptedPassword = encrypt(password, masterPassword);
        vaultItems.unshift({ id: Date.now(), website, username, password: encryptedPassword });
        await db.setItem('vault_items', vaultItems);
        renderVault();
        dom.entryWebsite.value = '';
        dom.entryUsername.value = '';
    }

    function renderVault() {
        const searchTerm = dom.searchVaultInput.value.toLowerCase();
        const filteredItems = vaultItems.filter(item => item.website.toLowerCase().includes(searchTerm) || item.username.toLowerCase().includes(searchTerm));
        dom.vaultList.innerHTML = '';
        filteredItems.forEach(item => {
            const li = document.createElement('li');
            li.className = 'vault-item';
            li.dataset.id = item.id;
            li.innerHTML = `
                <div class="vault-item-details">
                    <span class="item-website">${item.website}</span>
                    <span class="item-username">${item.username}</span>
                </div>
                <div class="vault-item-actions">
                    <button class="copy-user-btn" title="复制用户名"></button>
                    <button class="copy-pass-btn" title="复制密码"></button>
                    <button class="toggle-vis-btn" title="显示/隐藏密码"></button>
                    <button class="delete-item-btn" title="删除条目"></button>
                </div>`;
            dom.vaultList.appendChild(li);
        });
    }

    async function handleVaultAction(e) {
        const target = e.target;
        const itemEl = target.closest('.vault-item');
        if (!itemEl) return;
        const id = Number(itemEl.dataset.id);
        const item = vaultItems.find(i => i.id === id);
        
        if (target.matches('.copy-user-btn')) { navigator.clipboard.writeText(item.username).then(() => alert('用户名已复制!')); } 
        else if (target.matches('.copy-pass-btn')) { navigator.clipboard.writeText(decrypt(item.password, masterPassword)).then(() => alert('密码已复制!')); }
        else if (target.matches('.toggle-vis-btn')) {
            const usernameEl = itemEl.querySelector('.item-username');
            if (usernameEl.dataset.original) {
                 usernameEl.textContent = usernameEl.dataset.original;
                 delete usernameEl.dataset.original;
            } else {
                 usernameEl.dataset.original = usernameEl.textContent;
                 usernameEl.textContent = `密码: ${decrypt(item.password, masterPassword)}`;
            }
        } else if (target.matches('.delete-item-btn')) {
            if (confirm(`确定要删除 "${item.website}" 的条目吗？`)) {
                vaultItems = vaultItems.filter(i => i.id !== id);
                await db.setItem('vault_items', vaultItems);
                renderVault();
            }
        }
    }

    // --- Import / Export ---
    async function exportVault() {
        const data = { check: await db.getItem('vault_check'), items: await db.getItem('vault_items') };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `vault-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
    
    function importVault(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.check || !data.items) throw new Error('无效的备份文件。');
                if (confirm('确定要导入备份吗？这将覆盖所有现有数据！')) {
                    await db.setItem('vault_check', data.check);
                    await db.setItem('vault_items', data.items);
                    alert('导入成功！请使用该备份对应的主密码重新解锁。');
                    location.reload();
                }
            } catch (err) { alert('导入失败: ' + err.message); }
            dom.importFileInput.value = '';
        };
        reader.readAsText(file);
    }

    // --- Event Listeners ---
    dom.masterPasswordSubmit.addEventListener('click', handleMasterPasswordSubmit);
    dom.masterPasswordInput.addEventListener('keypress', e => { if (e.key === 'Enter') dom.masterPasswordSubmit.click(); });
    dom.masterPasswordConfirm.addEventListener('keypress', e => { if (e.key === 'Enter') dom.masterPasswordSubmit.click(); });
    
    [dom.lengthSlider, dom.includeUppercase, dom.includeLowercase, dom.includeNumbers, dom.includeSymbols, dom.excludeAmbiguous]
        .forEach(el => el.addEventListener('input', generatePassword));
    dom.lengthSlider.addEventListener('input', () => dom.lengthDisplay.textContent = dom.lengthSlider.value);
    
    dom.regenerateBtn.addEventListener('click', generatePassword);
    dom.copyPasswordBtn.addEventListener('click', () => { if(dom.passwordOutput.value) navigator.clipboard.writeText(dom.passwordOutput.value).then(() => alert('密码已复制!')); });
    
    dom.saveEntryBtn.addEventListener('click', saveEntry);
    dom.searchVaultInput.addEventListener('input', renderVault);
    dom.vaultList.addEventListener('click', handleVaultAction);
    dom.lockVaultBtn.addEventListener('click', () => location.reload());
    dom.exportVaultBtn.addEventListener('click', exportVault);
    dom.importVaultBtn.addEventListener('click', () => dom.importFileInput.click());
    dom.importFileInput.addEventListener('change', importVault);
    
    // --- Initial Load ---
    init();
});