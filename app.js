/**
 * 생활기록부 피드백 & 학생 수정 제출 시스템 JavaScript
 * 3학년 1반 (30101 ~ 30125)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 정확한 3학년 1반 학생 25명 명단
  const STUDENT_ROSTER = {
    "30101": "강민찬", "30102": "김송현", "30103": "박건모", "30104": "신윤서", "30105": "양민열",
    "30106": "이상엽", "30107": "조효성", "30108": "채무진", "30109": "김가현", "30110": "김아현",
    "30111": "김지효", "30112": "목감비", "30113": "박윤슬", "30114": "백서윤", "30115": "서연우",
    "30116": "신은송", "30117": "유지아", "30118": "임주희", "30119": "장가영", "30120": "정희원",
    "30121": "조수연", "30122": "조하은", "30123": "하채영", "30124": "황은서", "30125": "김보경"
  };

  const DOMAIN_LIMITS = {
    autonomy: 1500,
    career: 2100,
    korean: 1500,
    individual: 1500
  };

  const STORAGE_KEY = 'school_records_db_v2';
  const TEACHER_PASSWORD = 'teacher1234';

  // Application State
  let db = {
    students: {},
    teacherPassword: TEACHER_PASSWORD
  };

  let currentUser = null; // null | { role: 'student', id: '30101', name: '강민찬' } | { role: 'teacher' }
  let selectedStudentIdForTeacher = null;

  // Initialize Database
  function initDatabase() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        db = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved database', e);
        createNewDatabase();
      }
    } else {
      createNewDatabase();
    }
    // Ensure all 25 students exist in DB
    Object.keys(STUDENT_ROSTER).forEach(id => {
      if (!db.students[id]) {
        db.students[id] = createDefaultStudentObject(id, STUDENT_ROSTER[id]);
      } else {
        // Sync name if changed
        db.students[id].name = STUDENT_ROSTER[id];
      }
    });
    saveDatabase();
  }

  function createDefaultStudentObject(id, name) {
    return {
      id,
      name,
      password: id, // 초기 비밀번호는 학번과 동일
      isFirstLogin: true,
      status: 'unwritten', // 'unwritten' | 'writing' | 'submitted'
      updatedAt: null,
      careerHope: '',
      submissions: {
        autonomy: '',
        career: '',
        korean: '',
        individual: ''
      },
      feedbacks: {
        autonomy: { text: '', date: '' },
        career: { text: '', date: '' },
        korean: { text: '', date: '' },
        individual: { text: '', date: '' }
      }
    };
  }

  function createNewDatabase() {
    db = {
      students: {},
      teacherPassword: TEACHER_PASSWORD
    };
    Object.keys(STUDENT_ROSTER).forEach(id => {
      db.students[id] = createDefaultStudentObject(id, STUDENT_ROSTER[id]);
    });
  }

  function saveDatabase() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  // 2. 나이스(NEIS) 바이트 세기 함수
  // 한글/전각: 3 Byte, 영문/숫자/공백/반각: 1 Byte, 줄바꿈(\n, \r\n): 2 Byte
  function getNeisByteLength(str) {
    if (!str) return 0;
    let byteLength = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charAt(i);
      const code = str.charCodeAt(i);

      if (char === '\n') {
        byteLength += 2; // 엔터/줄바꿈은 NEIS 기준 2바이트
      } else if (char === '\r') {
        // \r\n 조합 처리
        continue;
      } else if (code <= 127) {
        byteLength += 1; // ASCII 영문, 숫자, 기본 기호, 공백 1바이트
      } else {
        byteLength += 3; // 한글, 한자, 전각기호 등 3바이트
      }
    }
    return byteLength;
  }

  // DOM Elements
  const elLoginSection = document.getElementById('login-section');
  const elStudentSection = document.getElementById('student-section');
  const elTeacherSection = document.getElementById('teacher-section');
  const elUserProfile = document.getElementById('user-profile');
  const elUserDisplayName = document.getElementById('user-display-name');
  const elUserRoleTag = document.getElementById('user-role-tag');

  const elStudentIdInput = document.getElementById('student-id');
  const elStudentNamePreview = document.getElementById('student-name-preview');
  const elPreviewNameText = document.getElementById('preview-name-text');

  // Login Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + '-form').classList.add('active');
    });
  });

  // Student ID Name Preview Handler
  elStudentIdInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (STUDENT_ROSTER[val]) {
      elPreviewNameText.textContent = STUDENT_ROSTER[val];
      elStudentNamePreview.classList.remove('hidden');
    } else {
      elStudentNamePreview.classList.add('hidden');
    }
  });

  // Student Login Submit
  document.getElementById('student-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = elStudentIdInput.value.trim();
    const pw = document.getElementById('student-pw').value;

    if (!db.students[id]) {
      showToast('올바른 학번(30101 ~ 30125)을 입력해주세요.', 'error');
      return;
    }

    const student = db.students[id];
    if (student.password !== pw) {
      showToast('비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    // Login Success
    currentUser = { role: 'student', id: id, name: student.name };
    showToast(`${student.name} 학생, 환영합니다!`, 'success');
    renderHeader();
    renderStudentWorkspace();

    // Check if First Login
    if (student.isFirstLogin) {
      openPwModal(true);
    }
  });

  // Teacher Login Submit
  document.getElementById('teacher-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = document.getElementById('teacher-pw').value;
    if (pw !== db.teacherPassword) {
      showToast('선생님 비밀번호가 올바르지 않습니다.', 'error');
      return;
    }

    currentUser = { role: 'teacher' };
    showToast('교사 관리자 모드로 접속했습니다.', 'success');
    renderHeader();
    renderTeacherDashboard();
  });

  // Logout Handler
  document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    renderHeader();
    showToast('로그아웃되었습니다.', 'success');
  });

  // Render Header
  function renderHeader() {
    if (!currentUser) {
      elUserProfile.classList.add('hidden');
      elLoginSection.classList.remove('hidden');
      elStudentSection.classList.add('hidden');
      elTeacherSection.classList.add('hidden');
      document.getElementById('student-pw').value = '';
    } else {
      elUserProfile.classList.remove('hidden');
      elLoginSection.classList.add('hidden');

      if (currentUser.role === 'student') {
        elUserRoleTag.textContent = '학생';
        elUserRoleTag.classList.remove('teacher');
        elUserDisplayName.textContent = `${currentUser.id} ${currentUser.name}`;
        elStudentSection.classList.remove('hidden');
        elTeacherSection.classList.add('hidden');
      } else {
        elUserRoleTag.textContent = '선생님';
        elUserRoleTag.classList.add('teacher');
        elUserDisplayName.textContent = '3학년 1반 담임교사';
        elStudentSection.classList.add('hidden');
        elTeacherSection.classList.remove('hidden');
      }
    }
  }

  // --------------------------------------------------------------------------
  // STUDENT WORKSPACE LOGIC
  // --------------------------------------------------------------------------
  const DOMAINS = ['autonomy', 'career', 'korean', 'individual'];

  function renderStudentWorkspace() {
    const student = db.students[currentUser.id];

    document.getElementById('student-welcome-title').textContent = `${student.id} ${student.name} 학생의 생활기록부 워크스페이스`;
    updateSubmitStatusBadge(student.status);

    // Fill Career Hope
    document.getElementById('input-career-hope').value = student.careerHope || '';

    // Fill Submissions & Feedbacks
    DOMAINS.forEach(domain => {
      const fb = student.feedbacks[domain];
      const fbEl = document.getElementById(`feedback-${domain}`);
      const fbDateEl = document.getElementById(`date-${domain}`);

      if (fb && fb.text) {
        fbEl.textContent = fb.text;
        fbDateEl.textContent = fb.date || '';
      } else {
        fbEl.textContent = '등록된 피드백이 없습니다.';
        fbDateEl.textContent = '-';
      }

      const inputEl = document.getElementById(`input-${domain}`);
      inputEl.value = student.submissions[domain] || '';

      updateByteCount(domain);
    });
  }

  function updateSubmitStatusBadge(status) {
    const badge = document.getElementById('submit-status-badge');
    if (status === 'submitted') {
      badge.textContent = '✅ 최종 제출 완료';
      badge.className = 'badge badge-success';
    } else if (status === 'writing') {
      badge.textContent = '✍️ 작성 중';
      badge.className = 'badge badge-info';
    } else {
      badge.textContent = '⏳ 미작성';
      badge.className = 'badge badge-warning';
    }
  }

  // Real-time Byte Counting for Inputs
  DOMAINS.forEach(domain => {
    const textarea = document.getElementById(`input-${domain}`);
    textarea.addEventListener('input', () => {
      updateByteCount(domain);
      autoSaveStudentData();
    });
  });

  document.getElementById('input-career-hope').addEventListener('input', () => {
    autoSaveStudentData();
  });

  function updateByteCount(domain) {
    const textarea = document.getElementById(`input-${domain}`);
    const bytes = getNeisByteLength(textarea.value);
    const chars = textarea.value.length;
    const maxBytes = DOMAIN_LIMITS[domain];

    const counterEl = document.getElementById(`byte-${domain}`);
    const progressEl = document.getElementById(`progress-${domain}`);

    counterEl.textContent = `${bytes} / ${maxBytes} Bytes (${chars}자)`;

    const percent = Math.min((bytes / maxBytes) * 100, 100);
    progressEl.style.width = `${percent}%`;

    // Warn / Danger styling
    counterEl.classList.remove('warn', 'danger');
    progressEl.classList.remove('warn', 'danger');

    if (bytes > maxBytes) {
      counterEl.classList.add('danger');
      progressEl.classList.add('danger');
    } else if (bytes >= maxBytes * 0.9) {
      counterEl.classList.add('warn');
      progressEl.classList.add('warn');
    }
  }

  // Auto Save Debouncer
  let autoSaveTimeout = null;
  function autoSaveStudentData() {
    if (!currentUser || currentUser.role !== 'student') return;

    const autoSaveIndicator = document.getElementById('auto-save-indicator');
    autoSaveIndicator.textContent = '⏳ 저장 중...';

    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      const student = db.students[currentUser.id];
      student.careerHope = document.getElementById('input-career-hope').value.trim();

      let hasContent = false;
      DOMAINS.forEach(domain => {
        const val = document.getElementById(`input-${domain}`).value;
        student.submissions[domain] = val;
        if (val.trim()) hasContent = true;
      });

      if (student.status !== 'submitted') {
        student.status = hasContent ? 'writing' : 'unwritten';
        updateSubmitStatusBadge(student.status);
      }

      student.updatedAt = new Date().toLocaleString();
      saveDatabase();

      autoSaveIndicator.textContent = '🔄 자동 저장됨';
    }, 600);
  }

  // Temporary Save Button
  document.getElementById('btn-temp-save').addEventListener('click', () => {
    autoSaveStudentData();
    showToast('임시 저장되었습니다.', 'success');
  });

  // Final Submit Button
  document.getElementById('btn-final-submit').addEventListener('click', () => {
    if (!confirm('작성하신 내용을 최종 제출하시겠습니까?\n제출 후에도 언제든지 수정하실 수 있습니다.')) return;

    const student = db.students[currentUser.id];
    student.careerHope = document.getElementById('input-career-hope').value.trim();
    DOMAINS.forEach(domain => {
      student.submissions[domain] = document.getElementById(`input-${domain}`).value;
    });

    student.status = 'submitted';
    student.updatedAt = new Date().toLocaleString();
    saveDatabase();

    updateSubmitStatusBadge('submitted');
    showToast('선생님께 성공적으로 최종 제출되었습니다!', 'success');
  });

  // Copy to Clipboard Buttons
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetInput = document.getElementById(targetId);
      if (!targetInput || !targetInput.value) {
        showToast('복사할 내용이 없습니다.', 'error');
        return;
      }

      navigator.clipboard.writeText(targetInput.value).then(() => {
        showToast('클립보드에 복사되었습니다!', 'success');
      }).catch(err => {
        showToast('복사에 실패했습니다.', 'error');
      });
    });
  });

  // --------------------------------------------------------------------------
  // TEACHER DASHBOARD LOGIC
  // --------------------------------------------------------------------------
  function renderTeacherDashboard() {
    const students = Object.values(db.students).sort((a, b) => a.id.localeCompare(b.id));

    let submittedCount = 0;
    let writingCount = 0;
    let unwrittenCount = 0;

    students.forEach(s => {
      if (s.status === 'submitted') submittedCount++;
      else if (s.status === 'writing') writingCount++;
      else unwrittenCount++;
    });

    document.getElementById('stat-submitted-count').textContent = `${submittedCount}명`;
    document.getElementById('stat-writing-count').textContent = `${writingCount}명`;
    document.getElementById('stat-unwritten-count').textContent = `${unwrittenCount}명`;

    renderStudentGrid();
  }

  function renderStudentGrid() {
    const grid = document.getElementById('student-grid');
    grid.innerHTML = '';

    const searchText = document.getElementById('student-search-input').value.toLowerCase().trim();
    const filterStatus = document.getElementById('student-status-filter').value;

    const students = Object.values(db.students).sort((a, b) => a.id.localeCompare(b.id));

    students.forEach(student => {
      // Filter logic
      if (filterStatus !== 'all' && student.status !== filterStatus) return;
      if (searchText && !student.id.includes(searchText) && !student.name.toLowerCase().includes(searchText)) return;

      const card = document.createElement('div');
      card.className = 'student-card';

      let statusBadgeClass = 'badge-warning';
      let statusText = '미작성';
      if (student.status === 'submitted') {
        statusBadgeClass = 'badge-success';
        statusText = '제출 완료';
      } else if (student.status === 'writing') {
        statusBadgeClass = 'badge-info';
        statusText = '작성 중';
      }

      card.innerHTML = `
        <div class="student-card-header">
          <span class="student-id-text">${student.id}</span>
          <span class="badge ${statusBadgeClass}">${statusText}</span>
        </div>
        <div class="student-name">${student.name}</div>
        <div class="student-card-footer">
          <span>최종 수정: ${student.updatedAt || '기록 없음'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        openTeacherEditModal(student.id);
      });

      grid.appendChild(card);
    });
  }

  // Teacher Filter Listeners
  document.getElementById('student-search-input').addEventListener('input', renderStudentGrid);
  document.getElementById('student-status-filter').addEventListener('change', renderStudentGrid);

  // Open Teacher Edit Modal
  function openTeacherEditModal(studentId) {
    selectedStudentIdForTeacher = studentId;
    const student = db.students[studentId];

    document.getElementById('teacher-modal-student-info').textContent = `${student.id} ${student.name} 학생 피드백 관리`;

    const badge = document.getElementById('teacher-modal-status-badge');
    if (student.status === 'submitted') {
      badge.textContent = '제출 완료';
      badge.className = 'badge badge-success';
    } else if (student.status === 'writing') {
      badge.textContent = '작성 중';
      badge.className = 'badge badge-info';
    } else {
      badge.textContent = '미작성';
      badge.className = 'badge badge-warning';
    }

    // Fill Teacher Tab Feedbacks & Student Submissions
    document.getElementById('t-career-hope-view').value = student.careerHope || '(미작성)';

    DOMAINS.forEach(domain => {
      document.getElementById(`t-feedback-${domain}`).value = student.feedbacks[domain]?.text || '';
      document.getElementById(`t-submission-${domain}`).textContent = student.submissions[domain] || '(학생이 작성한 수정본이 없습니다.)';
    });

    document.getElementById('teacher-edit-modal').classList.remove('hidden');
  }

  // Teacher Edit Tabs Handler
  document.querySelectorAll('.t-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.t-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.teacher-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.ttab).classList.add('active');
    });
  });

  // Save Teacher Feedback Button
  document.getElementById('btn-save-teacher-feedback').addEventListener('click', () => {
    if (!selectedStudentIdForTeacher) return;
    const student = db.students[selectedStudentIdForTeacher];
    const todayStr = new Date().toLocaleDateString('ko-KR');

    DOMAINS.forEach(domain => {
      const fbText = document.getElementById(`t-feedback-${domain}`).value.trim();
      student.feedbacks[domain] = {
        text: fbText,
        date: fbText ? todayStr : ''
      };
    });

    saveDatabase();
    showToast(`${student.name} 학생 피드백이 저장되었습니다.`, 'success');
    document.getElementById('teacher-edit-modal').classList.add('hidden');
    renderTeacherDashboard();
  });

  // Reset Student Password Button (Teacher)
  document.getElementById('btn-reset-student-pw').addEventListener('click', () => {
    if (!selectedStudentIdForTeacher) return;
    const student = db.students[selectedStudentIdForTeacher];
    if (confirm(`${student.name} 학생의 비밀번호를 초기값(${student.id})으로 리셋하시겠습니까?`)) {
      student.password = student.id;
      student.isFirstLogin = true;
      saveDatabase();
      showToast(`${student.name} 학생의 비밀번호가 ${student.id}로 초기화되었습니다.`, 'success');
    }
  });

  // Init Sample Feedbacks Button
  document.getElementById('btn-init-sample').addEventListener('click', () => {
    if (!confirm('30101~30125 전체 학생에게 예시 피드백을 생성하시겠습니까? (기존 피드백이 업데이트됩니다)')) return;

    const sampleFeedbacks = {
      autonomy: "학급 환경 정화 활동 및 학급 규칙 준수에 적극적으로 참여함. 특히 학급 자율 프로젝트에서 주도적인 태도로 팀원들의 의견을 수렴함.",
      career: "인공지능 및 융합 학문에 깊은 관심을 지님. 진로 관련 탐구 보고서 작성을 통해 문제 해결력을 과시함. 구체적인 사례 분석 보완 추천.",
      korean: "문학 작품을 감상하고 자신의 경험과 연계하여 깊이 있게 비평글을 작성함. 어휘 표현력 및 논리적 전개 구조가 뛰어남.",
      individual: "타인에 대한 배려심이 깊고 협동 학습 상황에서 맡은 바 역할을 솔선수범하여 완수함. 자기주도적 학습 능력이 매우 탁월함."
    };

    const todayStr = new Date().toLocaleDateString('ko-KR');

    Object.keys(db.students).forEach(id => {
      const student = db.students[id];
      DOMAINS.forEach(d => {
        student.feedbacks[d] = {
          text: `[${student.name} 학생 맞춤 피드백]\n${sampleFeedbacks[d]}`,
          date: todayStr
        };
      });
    });

    saveDatabase();
    showToast('샘플 피드백이 전체 학생에게 성공적으로 생성되었습니다.', 'success');
    renderTeacherDashboard();
  });

  // Export Data CSV
  document.getElementById('btn-export-all').addEventListener('click', () => {
    let csvContent = "\uFEFF학번,이름,제출상태,진로희망분야,자율활동_수정본,진로활동_수정본,국어세특_수정본,개인세특_수정본\n";

    Object.values(db.students).sort((a, b) => a.id.localeCompare(b.id)).forEach(s => {
      const escape = text => `"${(text || '').replace(/"/g, '""')}"`;
      csvContent += `${s.id},${s.name},${s.status},${escape(s.careerHope)},${escape(s.submissions.autonomy)},${escape(s.submissions.career)},${escape(s.submissions.korean)},${escape(s.submissions.individual)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `3학년1반_생기부_수정제출물_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('전체 제출물 CSV 다운로드가 완료되었습니다.', 'success');
  });

  // Export Data TXT
  document.getElementById('btn-export-txt').addEventListener('click', () => {
    let txtContent = "===================================================\n";
    txtContent += " 3학년 1반 생활기록부 학생 수정 제출물 통합 파일\n";
    txtContent += "===================================================\n\n";

    Object.values(db.students).sort((a, b) => a.id.localeCompare(b.id)).forEach(s => {
      txtContent += `[학번: ${s.id} | 이름: ${s.name} | 제출상태: ${s.status}]\n`;
      txtContent += `🎯 진로희망분야: ${s.careerHope || '(미작성)'}\n\n`;
      txtContent += `1. 창의적 체험활동 (자율활동):\n${s.submissions.autonomy || '(내용 없음)'}\n\n`;
      txtContent += `2. 창의적 체험활동 (진로활동):\n${s.submissions.career || '(내용 없음)'}\n\n`;
      txtContent += `3. 교과 세부능력 및 특기사항 (국어):\n${s.submissions.korean || '(내용 없음)'}\n\n`;
      txtContent += `4. 개인별 세부능력 및 특기사항:\n${s.submissions.individual || '(내용 없음)'}\n`;
      txtContent += `---------------------------------------------------\n\n`;
    });

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `3학년1반_생기부_통합텍스트_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    showToast('통합 TXT 파일 다운로드가 완료되었습니다.', 'success');
  });

  // --------------------------------------------------------------------------
  // MODAL LOGIC (PASSWORD CHANGE)
  // --------------------------------------------------------------------------
  const pwModal = document.getElementById('pw-modal');

  document.getElementById('btn-change-pw').addEventListener('click', () => openPwModal(false));

  function openPwModal(isFirst) {
    const desc = document.getElementById('pw-modal-desc');
    if (isFirst) {
      desc.textContent = '🔒 첫 로그인입니다. 안전한 생기부 관리를 위해 비밀번호를 새로 변경해 주세요.';
    } else {
      desc.textContent = '새로 사용할 비밀번호를 입력해주세요.';
    }
    document.getElementById('new-pw').value = '';
    document.getElementById('confirm-pw').value = '';
    pwModal.classList.remove('hidden');
  }

  document.getElementById('pw-change-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newPw = document.getElementById('new-pw').value;
    const confirmPw = document.getElementById('confirm-pw').value;

    if (newPw !== confirmPw) {
      showToast('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.', 'error');
      return;
    }

    if (currentUser.role === 'student') {
      const student = db.students[currentUser.id];
      student.password = newPw;
      student.isFirstLogin = false;
      saveDatabase();
      showToast('비밀번호가 성공적으로 변경되었습니다!', 'success');
    } else if (currentUser.role === 'teacher') {
      db.teacherPassword = newPw;
      saveDatabase();
      showToast('교사 관리자 비밀번호가 성공적으로 변경되었습니다!', 'success');
    }

    pwModal.classList.add('hidden');
  });

  // Close Modals
  document.querySelectorAll('.modal-close-btn, .modal-close-action').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    });
  });

  // --------------------------------------------------------------------------
  // TOAST NOTIFICATIONS
  // --------------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Initialize App
  initDatabase();
  renderHeader();
});
