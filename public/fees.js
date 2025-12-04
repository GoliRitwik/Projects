(function () {
  const token = AuthManager.getToken();
  const user = AuthManager.getCurrentUser();
  if (!token || !user) {
    window.location.href = '/login.html';
    return;
  }

  const apiBase = 'http://localhost:3000';
  const state = {
    students: [],
    invoices: []
  };
  const escapeHtml = (text = '') => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const els = {
    userInfo: document.getElementById('userInfo'),
    userName: document.getElementById('userName'),
    userRole: document.getElementById('userRole'),
    studentSelectFee: document.getElementById('studentSelectFee'),
    feeForm: document.getElementById('feeForm'),
    amountInput: document.getElementById('amount'),
    dueDateInput: document.getElementById('dueDate'),
    descriptionInput: document.getElementById('description'),
    paymentForm: document.getElementById('paymentForm'),
    invoiceSelect: document.getElementById('feeSelect'),
    payAmountInput: document.getElementById('payAmount'),
    paymentError: document.getElementById('paymentError'),
    feeStatusFilter: document.getElementById('feeStatusFilter'),
    feesBody: document.getElementById('feesBody'),
    noFees: document.getElementById('noFees'),
    exportButton: document.getElementById('exportFees'),
    loading: document.getElementById('loadingSpinner'),
    messages: document.getElementById('messageContainer')
  };

  function init() {
    if (els.userInfo) {
      els.userName.textContent = user.username;
      els.userRole.textContent = user.role;
      els.userInfo.style.display = 'flex';
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => AuthManager.logout());

    els.feeForm.addEventListener('submit', handleInvoiceSubmit);
    els.paymentForm.addEventListener('submit', handlePaymentSubmit);
    els.invoiceSelect.addEventListener('change', () => clearPaymentError());
    els.payAmountInput.addEventListener('input', () => clearPaymentError());
    els.feeStatusFilter.addEventListener('change', () => renderInvoices());
    els.exportButton.addEventListener('click', exportCSV);

    loadStudents();
    loadInvoices();
  }

  async function apiCall(endpoint, options = {}) {
    const response = await fetch(`${apiBase}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      ...options
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
  }

  function showLoading() {
    if (els.loading) els.loading.style.display = 'flex';
  }

  function hideLoading() {
    if (els.loading) els.loading.style.display = 'none';
  }

  function showMessage(message, type = 'info') {
    if (!els.messages) return;
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = `<i class="fas fa-info-circle"></i><span>${message}</span>`;
    els.messages.appendChild(div);
    setTimeout(() => div.remove(), 4500);
  }

  // Ensure jsPDF library is available - check multiple ways it might be loaded
  async function ensureJsPdfLoaded() {
    // Check if jsPDF is already available (multiple ways it might be exposed)
    if (window.jspdf && window.jspdf.jsPDF) return true;
    if (window.jsPDF) return true;

    const localSrc = '/vendor/jspdf.umd.min.js';
    const cdnSrc = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    
    // Check if script is already in the page (from HTML)
    const existingLocal = document.querySelector(`script[src="${localSrc}"]`);
    const existingCdn = document.querySelector(`script[src*="jspdf"]`);
    
    if (existingLocal || existingCdn) {
      const script = existingLocal || existingCdn;
      
      // Wait for script to load with timeout
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        const checkLoaded = () => {
          attempts++;
          if (window.jspdf && window.jspdf.jsPDF) {
            resolve(true);
          } else if (window.jsPDF) {
            resolve(true);
          } else if (attempts >= maxAttempts) {
            reject(new Error('jsPDF took too long to load'));
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        
        // If script is already loaded, check immediately
        if (script.readyState === 'complete' || script.readyState === 'loaded') {
          checkLoaded();
        } else {
          script.addEventListener('load', () => {
            setTimeout(checkLoaded, 100);
          });
          script.addEventListener('error', () => {
            reject(new Error('Failed to load jsPDF script from HTML'));
          });
          // Also start checking in case load event already fired
          checkLoaded();
        }
      });
    }

    // If not in page, dynamically load it
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = localSrc;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        setTimeout(() => {
          if (window.jspdf && window.jspdf.jsPDF) {
            resolve(true);
          } else if (window.jsPDF) {
            resolve(true);
          } else {
            reject(new Error('jsPDF loaded but not accessible'));
          }
        }, 100);
      };
      script.onerror = () => {
        // Try CDN if local failed
        const cdnScript = document.createElement('script');
        cdnScript.src = cdnSrc;
        cdnScript.async = true;
        cdnScript.crossOrigin = 'anonymous';
        cdnScript.onload = () => {
          setTimeout(() => {
            if (window.jspdf && window.jspdf.jsPDF) {
              resolve(true);
            } else if (window.jsPDF) {
              resolve(true);
            } else {
              reject(new Error('jsPDF loaded but not accessible'));
            }
          }, 100);
        };
        cdnScript.onerror = () => reject(new Error('Failed to load jsPDF from local and CDN'));
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    });
  }

  const formatCurrency = (value = 0) => {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  async function loadStudents() {
    try {
      showLoading();
      const res = await apiCall('/students');
      state.students = res.data || [];
      els.studentSelectFee.innerHTML = state.students
        .map(student => `<option value="${student.id}">${escapeHtml(student.name)}</option>`)
        .join('');
    } catch {
      showMessage('Unable to load students', 'error');
    } finally {
      hideLoading();
    }
  }

  async function loadInvoices() {
    try {
      showLoading();
      const res = await apiCall('/fees');
      state.invoices = res.data || [];
      renderInvoices();
      renderInvoiceSelect();
    } catch (error) {
      showMessage('Unable to load invoices', 'error');
    } finally {
      hideLoading();
    }
  }

  function renderInvoices() {
    if (!els.feesBody) return;
    const filter = els.feeStatusFilter.value;
    const dataset = filter ? state.invoices.filter(invoice => invoice.status === filter) : state.invoices;

    if (!dataset.length) {
      els.feesBody.innerHTML = '';
      if (els.noFees) els.noFees.style.display = 'block';
      return;
    }

    if (els.noFees) els.noFees.style.display = 'none';
    els.feesBody.innerHTML = dataset.map(invoice => {
      const balance = Math.max(Number(invoice.amount) - Number(invoice.paid_total || 0), 0);
      const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—';
      return `
        <tr>
          <td>#${invoice.id}</td>
          <td>${escapeHtml(invoice.student_name || invoice.student_id)}</td>
          <td class="currency">${formatCurrency(invoice.amount)}</td>
          <td>${dueDate}</td>
          <td><span class="status-badge status-${invoice.status}">${invoice.status}</span></td>
          <td class="invoice-actions">
            <button class="btn btn-secondary btn-download" type="button" data-download="${invoice.id}">
              <i class="fas fa-file-download"></i> Download PDF
            </button>
            <span class="text-muted">Due: ${formatCurrency(balance)}</span>
          </td>
        </tr>
      `;
    }).join('');

    // Attach download handlers
    els.feesBody.querySelectorAll('[data-download]').forEach(button => {
      button.addEventListener('click', () => {
        const invoice = state.invoices.find(item => String(item.id) === button.dataset.download);
        if (invoice) downloadInvoice(invoice);
      });
    });
  }

  function renderInvoiceSelect() {
    if (!els.invoiceSelect) return;
    if (!state.invoices.length) {
      els.invoiceSelect.innerHTML = '<option value="">No invoices available</option>';
      return;
    }
    els.invoiceSelect.innerHTML = state.invoices
      .map(invoice => {
        const balance = Math.max(Number(invoice.amount) - Number(invoice.paid_total || 0), 0);
        return `<option value="${invoice.id}" data-balance="${balance}">
            Invoice #${invoice.id} - ${escapeHtml(invoice.student_name || invoice.student_id)} (${invoice.status})
          </option>`;
      })
      .join('');
  }

  async function handleInvoiceSubmit(event) {
    event.preventDefault();
    const student_id = els.studentSelectFee.value;
    const amount = Number(els.amountInput.value);
    const due_date = els.dueDateInput.value;
    const description = els.descriptionInput.value.trim();

    if (!student_id || !due_date || !Number.isFinite(amount) || amount <= 0) {
      showMessage('Provide valid student, amount (> 0) and due date', 'error');
      return;
    }

    try {
      showLoading();
      const res = await apiCall('/fees', {
        method: 'POST',
        body: JSON.stringify({ student_id, amount, due_date, description })
      });
      if (res.success) {
        showMessage('Invoice created', 'success');
        els.feeForm.reset();
        await loadInvoices();
      } else {
        showMessage(res.message || 'Unable to create invoice', 'error');
      }
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      hideLoading();
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    clearPaymentError();
    const fee_id = els.invoiceSelect.value;
    const amount = Number(els.payAmountInput.value);
    const method = document.querySelector('input[name="method"]:checked')?.value || 'cash';
    if (!fee_id || !Number.isFinite(amount) || amount <= 0) {
      showMessage('Provide a valid amount', 'error');
      return;
    }

    const selectedOption = els.invoiceSelect.selectedOptions[0];
    const balance = Number(selectedOption?.dataset.balance || 0);
    if (balance && amount > balance + 0.01) {
      els.paymentError.textContent = `Amount exceeds remaining balance (${formatCurrency(balance)}).`;
      return;
    }

    try {
      showLoading();
      const res = await apiCall('/fees/pay', {
        method: 'POST',
        body: JSON.stringify({ fee_id, amount, method })
      });
      if (res.success) {
        showMessage('Payment recorded', 'success');
        els.paymentForm.reset();
        await loadInvoices();
      } else {
        showMessage(res.message || 'Unable to record payment', 'error');
      }
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      hideLoading();
    }
  }

  function clearPaymentError() {
    if (els.paymentError) els.paymentError.textContent = '';
  }

  function exportCSV() {
    if (!state.invoices.length) {
      showMessage('No invoices to export', 'info');
      return;
    }
    const header = ['Invoice ID', 'Student', 'Amount', 'Due Date', 'Status', 'Paid', 'Balance'];
    const rows = state.invoices.map(invoice => {
      const paid = Number(invoice.paid_total || 0);
      const balance = Math.max(Number(invoice.amount) - paid, 0);
      return [
        invoice.id,
        (invoice.student_name || invoice.student_id).replace(/,/g, ''),
        invoice.amount,
        invoice.due_date,
        invoice.status,
        paid.toFixed(2),
        balance.toFixed(2)
      ];
    });
    const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'invoices.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadInvoice(invoice) {
    // Show loading indicator
    showLoading();
    
    try {
      // Wait a bit for jsPDF to load if it's still loading
      let jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      
      // If not available, wait up to 3 seconds for it to load
      if (!jsPDF) {
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
          if (jsPDF) break;
        }
      }
      
      // If still not available, try to load it
      if (!jsPDF) {
        try {
          await ensureJsPdfLoaded();
          jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        } catch (err) {
          console.error('jsPDF load error', err);
          hideLoading();
          showMessage('Unable to load PDF generator. Please check your internet connection and try again, or use Export CSV instead.', 'error');
          return;
        }
      }
      
      if (!jsPDF) {
        hideLoading();
        showMessage('jsPDF library not found. Please refresh the page and try again.', 'error');
        return;
      }

      // Generate minimal clean PDF
      const doc = new jsPDF();
      let yPos = 20;
      
      // Helper function to format currency as plain text (no HTML entities)
      const formatCurrencyPlain = (value) => {
        const amount = Number(value) || 0;
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };
      
      // Header
      doc.setFontSize(16);
      doc.text('Invoice', 20, yPos);
      yPos += 10;
      
      // Invoice details - minimal and clean
      doc.setFontSize(11);
      const paid = Number(invoice.paid_total || 0);
      const balance = Math.max(Number(invoice.amount) - paid, 0);
      const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—';
      
      yPos += 8;
      doc.text(`Invoice ID: #${invoice.id}`, 20, yPos);
      yPos += 7;
      doc.text(`Student: ${invoice.student_name || invoice.student_id}`, 20, yPos);
      yPos += 7;
      doc.text(`Invoice Amount: ${formatCurrencyPlain(invoice.amount)}`, 20, yPos);
      yPos += 7;
      doc.text(`Amount Paid: ${formatCurrencyPlain(paid)}`, 20, yPos);
      yPos += 7;
      doc.text(`Balance Remaining: ${formatCurrencyPlain(balance)}`, 20, yPos);
      yPos += 7;
      
      // Payment method - get from latest payment if available
      if (paid > 0) {
        doc.text(`Payment Method: Cash`, 20, yPos); // Default, can be enhanced later
        yPos += 7;
      }
      
      doc.text(`Due Date: ${dueDate}`, 20, yPos);
      
      doc.save(`invoice-${invoice.id}.pdf`);
      hideLoading();
      showMessage('PDF downloaded successfully!', 'success');
    } catch (error) {
      console.error('PDF generation error:', error);
      hideLoading();
      showMessage('Error generating PDF: ' + error.message, 'error');
    }
  }

  init();
})();
