// ==========================================
// TEAM KPI TRACKING - JAVASCRIPT
// ==========================================

// SUPABASE CONFIGURATION
const LEGACY_STORAGE_KEY = 'kpiTrackingData';
const SUPABASE_CONFIG = window.KPI_SUPABASE_CONFIG || {};
const SUPABASE_URL = String(SUPABASE_CONFIG.url || 'https://oovdrqxuhclpwrtayvgm.supabase.co').replace(/\/$/, '');
const SUPABASE_ANON_KEY = String(SUPABASE_CONFIG.anonKey || '').trim();
const SUPABASE_TABLE = String(SUPABASE_CONFIG.table || 'kpis').trim() || 'kpis';
const SUPABASE_REST_URL = `${SUPABASE_URL}/rest/v1`;
const SHOULD_SEED_SAMPLE_DATA = SUPABASE_CONFIG.seedSampleData !== false;
const BUSINESS_TIMEZONE = 'Asia/Bangkok';
const BUSINESS_TIMEZONE_LABEL = 'UTC+7';
const BUSINESS_TIMEZONE_OFFSET = '+07:00';

// Current KPI ID for editing
let editingKpiId = null;
let smartTooltipElement = null;
let selectedKpiIds = new Set();
let pendingDeleteIds = [];
let isProgressOverviewExpanded = false;
let progressOverviewSort = 'status-priority';
let progressOverviewView = 'grid';
let expandedKpiRowIds = new Set();
let activeKpiRowMenuId = null;
let kpiTableDensity = 'comfortable';
let kpiTableSort = { key: 'name', direction: 'asc' };
let kpiStore = [];
let shouldSyncFinalRatingToGuide = true;
let lastFocusedElement = null;
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(', ');
const SMART_GUIDE_CONTENT = {
    specific: {
        badge: 'S',
        label: 'Specific',
        helper: 'What is the exact goal?'
    },
    measurable: {
        badge: 'M',
        label: 'Measurable',
        helper: 'How success is measured.'
    },
    achievable: {
        badge: 'A',
        label: 'Achievable',
        helper: 'Why the target is realistic.'
    },
    relevant: {
        badge: 'R',
        label: 'Relevant',
        helper: 'Why this KPI matters.'
    },
    timeBound: {
        badge: 'T',
        label: 'Time-bound',
        helper: 'When it must be completed.'
    }
};
const RATING_GUIDE_CONTENT = {
    1: { label: 'Poor', className: 'rating-poor' },
    2: { label: 'Below Expectation', className: 'rating-below' },
    3: { label: 'Meets Expectation', className: 'rating-meets' },
    4: { label: 'Exceeds Expectation', className: 'rating-exceeds' },
    5: { label: 'Outstanding', className: 'rating-outstanding' }
};
const DEFAULT_RATING_CRITERIA = Object.freeze({
    rating2Min: 70,
    rating3Min: 100,
    rating4Min: 110,
    rating5Min: 125
});

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    setDefaultFormDates();
    hydrateStaticUi();
    
    // Event listeners
    document.getElementById('addKpiBtn').addEventListener('click', openAddModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('closeDeleteBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
    
    document.getElementById('kpiForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('searchInput').addEventListener('input', filterAndRender);
    document.getElementById('yearFilter').addEventListener('change', filterAndRender);
    document.getElementById('teamFilter').addEventListener('change', filterAndRender);
    document.getElementById('ownerFilter').addEventListener('change', filterAndRender);
    document.getElementById('statusFilter').addEventListener('change', filterAndRender);
    document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
    document.getElementById('bulkDeleteBtn').addEventListener('click', handleBulkDelete);
    document.getElementById('progressToggleBtn').addEventListener('click', toggleProgressOverview);
    document.getElementById('progressSortControl').addEventListener('change', handleProgressOverviewSortChange);
    document.getElementById('progressGridViewBtn').addEventListener('click', () => setProgressOverviewView('grid'));
    document.getElementById('progressListViewBtn').addEventListener('click', () => setProgressOverviewView('list'));
    document.getElementById('importFileBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', handleImportFile);
    document.getElementById('exportCsvBtn').addEventListener('click', exportKpisAsCsv);
    document.querySelector('.kpi-table thead').addEventListener('change', handleTableHeaderChange);
    document.getElementById('kpiTableBody').addEventListener('change', handleTableSelectionChange);
    document.getElementById('kpiTableBody').addEventListener('click', handleTableBodyClick);
    document.querySelector('.kpi-table thead').addEventListener('click', handleTableSortClick);
    document.getElementById('tableComfortableBtn').addEventListener('click', () => setKpiTableDensity('comfortable'));
    document.getElementById('tableCompactBtn').addEventListener('click', () => setKpiTableDensity('compact'));
    document.addEventListener('keydown', handleGlobalKeydown);
    document.getElementById('kpiTarget').addEventListener('input', updateRatingSuggestion);
    document.getElementById('kpiActual').addEventListener('input', updateRatingSuggestion);
    document.getElementById('kpiRatingGrade').addEventListener('change', handleRatingGradeChange);
    document.getElementById('rating2Min').addEventListener('input', updateRatingSuggestion);
    document.getElementById('rating3Min').addEventListener('input', updateRatingSuggestion);
    document.getElementById('rating4Min').addEventListener('input', updateRatingSuggestion);
    document.getElementById('rating5Min').addEventListener('input', updateRatingSuggestion);
    ['kpiName', 'kpiOwner', 'kpiTeam', 'kpiStartDate', 'kpiEndDate', 'kpiLastYearResult', 'kpiUnit', 'smartSpecific', 'smartMeasurable', 'smartAchievable', 'smartRelevant', 'smartTimeBound']
        .forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', updateEvaluationContextPanel);
                input.addEventListener('change', updateEvaluationContextPanel);
            }
        });
    document.addEventListener('click', handleDocumentClick);
    
    // Close KPI modal when clicking outside
    const kpiModal = document.getElementById('kpiModal');
    if (kpiModal) {
        kpiModal.addEventListener('click', (e) => {
            if (e.target === kpiModal) {
                closeModal();
            }
        });
    }
    
    // Close delete modal when clicking outside
    const deleteModal = document.getElementById('deleteModal');
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                closeDeleteModal();
            }
        });
    }
    
    // Detail modal
    const detailModal = document.getElementById('detailModal');
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
    
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeDetailModal();
        });
    }
    
    if (closeDetailModalBtn) {
        closeDetailModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeDetailModal();
        });
    }
    
    // Close detail modal when clicking outside
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                closeDetailModal();
            }
        });
    }
    
    // Confirm and execute delete
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (pendingDeleteIds.length > 0) {
                try {
                    await deleteKpis(pendingDeleteIds);
                } catch (error) {
                    handlePersistenceError('Could not delete KPI records.', error);
                    return;
                }

                pendingDeleteIds.forEach(id => selectedKpiIds.delete(id));
                closeDeleteModal();
                refreshUi({ refreshFilters: true });
                showAppStatus('KPI records deleted.', 'success');
            }
        });
    }
    
    // Check SMART criteria when switching focus
    document.addEventListener('change', checkSmartCriteria);
    
    // Keep SMART tooltip in sync with scroll and resize
    smartTooltipElement = document.getElementById('smartTooltip');
    attachSmartHelperTooltipListeners();
    window.addEventListener('scroll', hideSmartTooltip, true);
    window.addEventListener('resize', () => {
        hideSmartTooltip();
        renderProgressOverview();
    });
    
    initializeApp();
});

async function initializeApp() {
    try {
        await loadKpiData();
    } catch (error) {
        handlePersistenceError('Could not load KPI data from Supabase.', error);
    } finally {
        renderDashboard();
        populateAllFilters();
        filterAndRender();
    }
}

function setDefaultFormDates() {
    const startDateInput = document.getElementById('kpiStartDate');
    if (startDateInput && !startDateInput.value) {
        startDateInput.valueAsDate = new Date();
    }
}

function hydrateStaticUi() {
    // Summary card icons are injected here so the HTML stays simple and the visual set stays consistent.
    const summaryCardIcons = [
        `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19h16"></path>
                <path d="M7 15V9"></path>
                <path d="M12 15V5"></path>
                <path d="M17 15v-3"></path>
            </svg>
        `,
        `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 16l4-4 4 3 6-7"></path>
                <path d="M15 8h4v4"></path>
            </svg>
        `,
        `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4l8 14H4L12 4z"></path>
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
            </svg>
        `,
        `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="8"></circle>
                <path d="M9 9l6 6"></path>
                <path d="M15 9l-6 6"></path>
            </svg>
        `,
        `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z"></path>
                <path d="M9.5 12.3l1.7 1.7 3.6-4"></path>
            </svg>
        `,
        `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6L12 3z"></path>
                <path d="M12 14.5v5.5"></path>
                <path d="M9.5 17.5h5"></path>
            </svg>
        `
    ];
    const summaryCardClasses = [
        'summary-total',
        'summary-on-track',
        'summary-at-risk',
        'summary-off-track',
        'summary-completed',
        'summary-avg-rating'
    ];

    document.querySelectorAll('.card-summary').forEach((card, index) => {
        const iconElement = card.querySelector('.card-icon');

        summaryCardClasses.forEach(className => card.classList.remove(className));
        if (summaryCardClasses[index]) {
            card.classList.add(summaryCardClasses[index]);
        }

        if (iconElement) {
            iconElement.innerHTML = summaryCardIcons[index] || summaryCardIcons[0];
            iconElement.setAttribute('aria-hidden', 'true');
        }
    });

    renderKpiTableHeader();
}

function refreshUi({ refreshFilters = false } = {}) {
    pruneSelectedKpiIds();
    renderDashboard();

    if (refreshFilters) {
        populateAllFilters();
    }

    filterAndRender();
}

// ==========================================
// SUPABASE DATA FUNCTIONS
// ==========================================

function getKpiData() {
    return kpiStore.map(normalizeStoredKpiRecord);
}

function getLegacyKpiData() {
    try {
        const data = localStorage.getItem(LEGACY_STORAGE_KEY);
        const parsedData = data ? JSON.parse(data) : [];
        return Array.isArray(parsedData) ? parsedData.map(normalizeStoredKpiRecord) : [];
    } catch (error) {
        return [];
    }
}

function persistLegacyBackup(kpis) {
    try {
        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(kpis));
    } catch (error) {
    }
}

function setKpiCache(kpis) {
    kpiStore = kpis
        .map((kpi, index) => normalizeStoredKpiRecord({
            ...kpi,
            sortOrder: Number.isFinite(Number(kpi.sortOrder)) ? Number(kpi.sortOrder) : index
        }))
        .sort((left, right) => {
            const sortDifference = left.sortOrder - right.sortOrder;
            if (sortDifference !== 0) {
                return sortDifference;
            }

            return left.id - right.id;
        });
}

function ensureSupabaseConfigured() {
    if (!SUPABASE_URL) {
        throw new Error('Supabase URL is missing.');
    }

    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'PASTE_SUPABASE_ANON_KEY_HERE') {
        throw new Error('Set your Supabase anon key in index.html before using the KPI dashboard.');
    }
}

function getSupabaseHeaders({ prefer = null } = {}) {
    const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    };

    if (prefer) {
        headers.Prefer = prefer;
    }

    return headers;
}

function buildSupabaseTableUrl(search = '') {
    return `${SUPABASE_REST_URL}/${encodeURIComponent(SUPABASE_TABLE)}${search}`;
}

async function supabaseRequest(search = '', options = {}) {
    ensureSupabaseConfigured();

    const response = await fetch(buildSupabaseTableUrl(search), {
        method: options.method || 'GET',
        headers: {
            ...getSupabaseHeaders({ prefer: options.prefer }),
            ...options.headers
        },
        body: options.body
    });

    const rawBody = await response.text();
    let responseData = null;

    if (rawBody) {
        try {
            responseData = JSON.parse(rawBody);
        } catch (error) {
            responseData = rawBody;
        }
    }

    if (!response.ok) {
        const errorMessage = typeof responseData === 'object' && responseData !== null
            ? responseData.message || responseData.hint || rawBody || `HTTP ${response.status}`
            : responseData || `HTTP ${response.status}`;
        throw new Error(errorMessage);
    }

    return responseData;
}

function mapSupabaseRowToKpi(row) {
    return normalizeStoredKpiRecord({
        id: Number(row.id),
        name: row.name || '',
        owner: row.owner || '',
        team: row.team || '',
        department: row.department || '',
        target: Number(row.target),
        lastYearResult: Number.isFinite(Number(row.last_year_result)) ? Number(row.last_year_result) : null,
        actual: Number(row.actual),
        unit: row.unit || '',
        startDate: row.start_date || '',
        endDate: row.end_date || '',
        ratingGrade: row.rating_grade,
        ratingCriteria: typeof row.rating_criteria === 'object' && row.rating_criteria ? row.rating_criteria : {},
        ratingJustification: row.rating_justification || '',
        midYearComment: row.midyear_comment || '',
        yearEndComment: row.yearend_comment || '',
        remark: row.remark || '',
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || '',
        smart: typeof row.smart === 'object' && row.smart ? row.smart : {},
        sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0
    });
}

function mapKpiToSupabaseRow(kpi, sortOrder) {
    const normalizedKpi = normalizeStoredKpiRecord({
        ...kpi,
        sortOrder
    });

    return {
        id: normalizedKpi.id,
        name: normalizedKpi.name,
        owner: normalizedKpi.owner,
        team: normalizedKpi.team,
        department: normalizedKpi.department || null,
        target: normalizedKpi.target,
        last_year_result: normalizedKpi.lastYearResult,
        actual: normalizedKpi.actual,
        unit: normalizedKpi.unit,
        start_date: normalizedKpi.startDate,
        end_date: normalizedKpi.endDate,
        rating_grade: normalizedKpi.ratingGrade,
        rating_criteria: normalizedKpi.ratingCriteria,
        rating_justification: normalizedKpi.ratingJustification,
        midyear_comment: normalizedKpi.midYearComment,
        yearend_comment: normalizedKpi.yearEndComment,
        remark: normalizedKpi.remark || null,
        created_at: normalizedKpi.createdAt || getCurrentBusinessTimestamp(),
        updated_at: normalizedKpi.updatedAt || getCurrentBusinessTimestamp(),
        smart: normalizedKpi.smart,
        sort_order: normalizedKpi.sortOrder
    };
}

async function fetchRemoteKpis() {
    const rows = await supabaseRequest('?select=*');
    return Array.isArray(rows) ? rows.map(mapSupabaseRowToKpi) : [];
}

async function upsertRemoteKpis(kpis) {
    if (kpis.length === 0) {
        return [];
    }

    const payload = kpis.map((kpi, index) => mapKpiToSupabaseRow(kpi, index));
    const rows = await supabaseRequest('?on_conflict=id', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        prefer: 'resolution=merge-duplicates,return=representation',
        body: JSON.stringify(payload)
    });

    return Array.isArray(rows) ? rows.map(mapSupabaseRowToKpi) : [];
}

async function deleteRemoteKpis(ids) {
    if (ids.length === 0) {
        return;
    }

    await supabaseRequest(`?id=in.(${ids.join(',')})`, {
        method: 'DELETE',
        prefer: 'return=minimal'
    });
}

async function saveKpiData(kpis) {
    const normalizedKpis = kpis.map((kpi, index) => normalizeStoredKpiRecord({
        ...kpi,
        sortOrder: index
    }));
    const previousIds = new Set(kpiStore.map(kpi => kpi.id));
    const nextIds = new Set(normalizedKpis.map(kpi => kpi.id));
    const idsToDelete = [...previousIds].filter(id => !nextIds.has(id));

    if (idsToDelete.length > 0) {
        await deleteRemoteKpis(idsToDelete);
    }

    let savedRemoteKpis = [];
    if (normalizedKpis.length > 0) {
        savedRemoteKpis = await upsertRemoteKpis(normalizedKpis);
    }

    const persistedKpis = savedRemoteKpis.length > 0 ? savedRemoteKpis : normalizedKpis;
    setKpiCache(persistedKpis);
    persistLegacyBackup(persistedKpis);
}

function getSampleKpis() {
    return [
        {
            id: Date.now() + 1,
            name: 'Sales Revenue Growth',
            owner: 'John Smith',
            team: 'Sales',
            department: 'Revenue',
            target: 1000000,
            lastYearResult: 820000,
            actual: 750000,
            unit: 'USD',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            ratingGrade: 4,
            ratingCriteria: {
                rating2Min: 75,
                rating3Min: 100,
                rating4Min: 115,
                rating5Min: 130
            },
            ratingJustification: 'Revenue landed below the formal guide, but the team secured a strategic market launch and built a stronger pipeline for next year.',
            midYearComment: 'Strong revenue momentum in the first half. New client acquisition is healthy, but pipeline conversion should be monitored more closely in Q3.',
            yearEndComment: 'Finished the year above internal stretch expectations with strong regional growth and better forecast discipline.',
            remark: 'Q1-Q4 Revenue target with focus on new market expansion',
            createdAt: '2026-01-05T09:00:00.000Z',
            updatedAt: '2026-12-20T09:00:00.000Z',
            smart: {
                specific: 'Increase total sales revenue to reach $1M',
                measurable: 'Track monthly revenue against target KPI',
                achievable: 'Based on historical data and market growth',
                relevant: 'Critical for company growth',
                timeBound: 'End of fiscal year 2026'
            }
        },
        {
            id: Date.now() + 2,
            name: 'Customer Satisfaction Score',
            owner: 'Sarah Johnson',
            team: 'Customer Service',
            department: 'Operations',
            target: 95,
            lastYearResult: 91,
            actual: 88,
            unit: '%',
            startDate: '2026-01-01',
            endDate: '2026-06-30',
            ratingGrade: 3,
            ratingCriteria: {
                rating2Min: 70,
                rating3Min: 95,
                rating4Min: 105,
                rating5Min: 115
            },
            ratingJustification: 'Service quality stabilized during a high-ticket volume period, so the manager kept the final rating at baseline expectation.',
            midYearComment: 'Customer sentiment remains stable. Response quality is good, though issue resolution speed still needs improvement.',
            yearEndComment: 'Met baseline expectations and maintained service quality, with clear opportunity to improve turnaround time.',
            remark: 'Maintain customer satisfaction above 90% benchmark',
            createdAt: '2026-01-07T09:00:00.000Z',
            updatedAt: '2026-06-25T09:00:00.000Z',
            smart: {
                specific: 'Achieve customer satisfaction score of 95%',
                measurable: 'Monthly satisfaction survey scores',
                achievable: 'Through improved response time and training',
                relevant: 'Improves customer retention and loyalty',
                timeBound: 'H1 2026'
            }
        },
        {
            id: Date.now() + 3,
            name: 'Employee Training Hours',
            owner: 'Michael Chen',
            team: 'HR',
            department: 'Human Resources',
            target: 80,
            lastYearResult: 52,
            actual: 45,
            unit: 'hours',
            startDate: '2026-02-01',
            endDate: '2026-08-31',
            ratingGrade: 2,
            ratingCriteria: {
                rating2Min: 65,
                rating3Min: 90,
                rating4Min: 105,
                rating5Min: 120
            },
            ratingJustification: 'The team faced system onboarding delays, but manager feedback recognized recovery effort and knowledge-sharing contribution.',
            midYearComment: 'Training participation started slowly. Team engagement improved after manager follow-up, but the pace is still below target.',
            yearEndComment: 'Did not reach the expected level this cycle. A more structured learning plan and monthly checkpoints are recommended.',
            remark: 'Professional development goals for team upskilling',
            createdAt: '2026-02-03T09:00:00.000Z',
            updatedAt: '2026-08-18T09:00:00.000Z',
            smart: {
                specific: 'Complete 80 hours of employee training',
                measurable: 'Track training hours per employee',
                achievable: 'Through online courses and workshops',
                relevant: 'Enhances team capabilities',
                timeBound: 'Before end of Q3 2026'
            }
        },
        {
            id: Date.now() + 4,
            name: 'Project Delivery On-Time',
            owner: 'Emily Davis',
            team: 'Project Management',
            department: 'Operations',
            target: 100,
            lastYearResult: 92,
            actual: 95,
            unit: '%',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            ratingGrade: 5,
            ratingCriteria: {
                rating2Min: 80,
                rating3Min: 100,
                rating4Min: 108,
                rating5Min: 118
            },
            ratingJustification: 'Leadership impact and consistent risk management were weighted above the pure percentage result in the final review.',
            midYearComment: 'Project planning quality is excellent. Risks are surfaced early and stakeholder communication is consistently strong.',
            yearEndComment: 'Outstanding delivery discipline throughout the year. Consistently set the benchmark for schedule reliability and team coordination.',
            remark: 'Achieve 100% on-time project delivery rate',
            createdAt: '2026-01-04T09:00:00.000Z',
            updatedAt: '2026-12-15T09:00:00.000Z',
            smart: {
                specific: 'Deliver all projects within agreed timelines',
                measurable: 'Percentage of projects delivered on-time',
                achievable: 'With improved planning and resource allocation',
                relevant: 'Critical for client satisfaction',
                timeBound: 'Throughout 2026'
            }
        },
        {
            id: Date.now() + 5,
            name: 'Cost Reduction Initiative',
            owner: 'Robert Wilson',
            team: 'Finance',
            department: 'Finance',
            target: 150000,
            lastYearResult: 98000,
            actual: 120000,
            unit: 'USD',
            startDate: '2026-03-01',
            endDate: '2026-09-30',
            ratingGrade: 1,
            ratingCriteria: {
                rating2Min: 75,
                rating3Min: 100,
                rating4Min: 112,
                rating5Min: 128
            },
            ratingJustification: 'Several initiatives were outside the owner’s control, but the overall savings gap still kept the final rating conservative.',
            midYearComment: 'Early savings initiatives were delayed and ownership was unclear across several workstreams.',
            yearEndComment: 'Results fell materially short of expectations. Recommend tighter milestone ownership and earlier executive escalation next cycle.',
            remark: 'Reduce operational costs through efficiency improvements',
            createdAt: '2026-03-02T09:00:00.000Z',
            updatedAt: '2026-09-25T09:00:00.000Z',
            smart: {
                specific: 'Reduce operational expenses by $150,000',
                measurable: 'Monthly monitoring of cost savings against baseline',
                achievable: 'Through process optimization',
                relevant: 'Improves profit margins',
                timeBound: 'Q3 2026'
            }
        }
    ];
}

async function loadKpiData() {
    const remoteKpis = await fetchRemoteKpis();
    if (remoteKpis.length > 0) {
        setKpiCache(remoteKpis);
        persistLegacyBackup(getKpiData());
        return;
    }

    const legacyKpis = getLegacyKpiData();
    const seedKpis = legacyKpis.length > 0
        ? legacyKpis
        : SHOULD_SEED_SAMPLE_DATA
            ? getSampleKpis()
            : [];

    if (seedKpis.length > 0) {
        await saveKpiData(seedKpis);
        return;
    }

    setKpiCache([]);
}

// ==========================================
// KPI CRUD OPERATIONS
// ==========================================

// Create new KPI
async function addKpi(kpiData) {
    const kpis = getKpiData();
    const nowIso = getCurrentBusinessTimestamp();
    const newKpi = {
        id: Date.now(),
        sortOrder: kpis.length,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...kpiData
    };
    kpis.push(newKpi);
    await saveKpiData(kpis);
    return newKpi;
}

// Update existing KPI
async function updateKpi(id, kpiData) {
    let kpis = getKpiData();
    const index = kpis.findIndex(kpi => kpi.id === id);
    if (index !== -1) {
        kpis[index] = {
            ...kpis[index],
            ...kpiData,
            updatedAt: getCurrentBusinessTimestamp(),
            id
        };
        await saveKpiData(kpis);
        return kpis[index];
    }
    return null;
}

// Delete KPI
async function deleteKpi(id) {
    let kpis = getKpiData();
    kpis = kpis.filter(kpi => kpi.id !== id);
    await saveKpiData(kpis);
}

async function deleteKpis(ids) {
    const idSet = new Set(ids);
    const remainingKpis = getKpiData().filter(kpi => !idSet.has(kpi.id));
    await saveKpiData(remainingKpis);
}

// Get KPI by ID
function getKpiById(id) {
    const kpis = getKpiData();
    return kpis.find(kpi => kpi.id === id);
}

// ==========================================
// CALCULATION FUNCTIONS
// ==========================================

// Calculate progress percentage
function calculateProgress(actual, target) {
    if (target <= 0) return 0;
    return (actual / target) * 100;
}

// Get status based on progress
function getStatus(progress) {
    if (progress >= 100) return 'Completed';
    if (progress >= 70) return 'On-track';
    if (progress >= 40) return 'At-risk';
    return 'Off-track';
}

// Check if SMART criteria is complete
function isSmartComplete(smart) {
    if (!smart) return false;
    return (
        smart.specific && smart.specific.trim() !== '' &&
        smart.measurable && smart.measurable.trim() !== '' &&
        smart.achievable && smart.achievable.trim() !== '' &&
        smart.relevant && smart.relevant.trim() !== '' &&
        smart.timeBound && smart.timeBound.trim() !== ''
    );
}

// Get dashboard stats for the current KPI collection.
function getDashboardStats(kpis = getKpiData()) {
    const stats = {
        total: kpis.length,
        completed: 0,
        onTrack: 0,
        atRisk: 0,
        offTrack: 0,
        totalRatingScore: 0,
        averageRating: 0
    };
    
    kpis.forEach(kpi => {
        const progress = calculateProgress(kpi.actual, kpi.target);
        const status = getStatus(progress);
        stats.totalRatingScore += normalizeRatingGrade(kpi.ratingGrade);
        
        switch (status) {
            case 'Completed':
                stats.completed++;
                break;
            case 'On-track':
                stats.onTrack++;
                break;
            case 'At-risk':
                stats.atRisk++;
                break;
            case 'Off-track':
                stats.offTrack++;
                break;
        }
    });

    if (stats.total > 0) {
        stats.averageRating = stats.totalRatingScore / stats.total;
    }
    
    return stats;
}

// ==========================================
// UI RENDERING FUNCTIONS
// ==========================================

// Render dashboard summary cards
function renderDashboard() {
    const stats = getDashboardStats(getFilteredKpis());
    
    document.getElementById('totalKpis').textContent = stats.total;
    document.getElementById('onTrackKpis').textContent = stats.onTrack;
    document.getElementById('atRiskKpis').textContent = stats.atRisk;
    document.getElementById('offTrackKpis').textContent = stats.offTrack;
    document.getElementById('completedKpis').textContent = stats.completed;
    const avgRatingElement = document.getElementById('avgRating');
    const avgRatingMetaElement = document.getElementById('avgRatingMeta');
    if (avgRatingElement) {
        avgRatingElement.textContent = stats.total > 0 ? stats.averageRating.toFixed(1) : '0.0';
    }
    if (avgRatingMetaElement) {
        const averageStatus = stats.averageRating > 3
            ? 'Above target'
            : stats.averageRating < 3 && stats.total > 0
                ? 'Below target'
                : 'On target';
        avgRatingMetaElement.textContent = stats.total > 0
            ? `Target 3.0 / ${averageStatus}`
            : 'Target 3.0';
    }
}

// Render progress overview
function renderProgressOverview() {
    const container = document.getElementById('progressOverview');
    if (!container) {
        return;
    }
    
    const kpis = getFilteredKpis();
    
    if (kpis.length === 0) {
        container.innerHTML = '<p class="empty-state">No KPIs yet. Create one to get started!</p>';
        return;
    }
    
    let html = '';
    kpis.forEach(kpi => {
        const progress = calculateProgress(kpi.actual, kpi.target);
        const status = getStatus(progress);
        const progressColor = getProgressColor(status);
        
        html += `
            <div class="progress-item">
                <div class="progress-header">
                    <span class="progress-title">${escapeHtml(kpi.name)}</span>
                    <span class="progress-percent">${Math.round(progress)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="transform: scaleX(${Math.min(progress, 100) / 100}); background: ${progressColor};"></div>
                </div>
                <div class="progress-details">
                    <span>${escapeHtml(kpi.owner)} • ${escapeHtml(kpi.team)}</span>
                    <span>${Math.round(kpi.actual)} / ${kpi.target} ${kpi.unit}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Get progress color based on status
function getProgressColor(status) {
    const colors = {
        'Completed': '#10b981',
        'On-track': '#3b82f6',
        'At-risk': '#f59e0b',
        'Off-track': '#ef4444'
    };
    return colors[status] || '#4f46e5';
}

// Render KPI table
function renderKpiTable() {
    const kpis = getFilteredKpis();
    const tbody = document.getElementById('kpiTableBody');
    
    if (kpis.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="11" class="empty-message">No KPI records found</td></tr>';
        return;
    }
    
    let html = '';
    kpis.forEach(kpi => {
        const progress = calculateProgress(kpi.actual, kpi.target);
        const status = getStatus(progress);
        const smartStatus = isSmartComplete(kpi.smart) ? 'Complete' : 'Incomplete';
        const smartClass = isSmartComplete(kpi.smart) ? '' : 'incomplete';
        const smartDetails = getSmartDetails(kpi.smart);
        const isSelected = selectedKpiIds.has(kpi.id);
        
        html += `
            <tr class="${isSelected ? 'selected-row' : ''}" data-kpi-id="${kpi.id}">
                <td class="selection-cell" data-label="Select">
                    <input
                        type="checkbox"
                        class="row-select-checkbox"
                        data-kpi-id="${kpi.id}"
                        aria-label="Select ${escapeHtml(kpi.name)}"
                        ${isSelected ? 'checked' : ''}
                    >
                </td>
                <td class="drag-handle" title="Drag to reorder">⋮⋮</td>
                <td data-label="KPI">
                    <div class="kpi-name-cell">
                        <strong>${escapeHtml(kpi.name)}</strong>
                        <span class="kpi-subtext">${formatDisplayDate(kpi.startDate)} - ${formatDisplayDate(kpi.endDate)}</span>
                    </div>
                </td>
                <td data-label="Owner">${escapeHtml(kpi.owner)}</td>
                <td data-label="Team">${escapeHtml(kpi.team)}</td>
                <td data-label="Target"><div class="metric-stack"><strong>${kpi.target}</strong><span>${escapeHtml(kpi.unit)}</span></div></td>
                <td data-label="Actual"><div class="metric-stack"><strong>${kpi.actual}</strong><span>${escapeHtml(kpi.unit)}</span></div></td>
                <td data-label="Progress">
                    <div class="table-progress">
                        <div class="table-progress-track">
                            <div class="table-progress-fill" style="transform: scaleX(${Math.min(progress, 100) / 100}); background: ${getProgressColor(status)};"></div>
                        </div>
                        <span>${Math.round(progress)}%</span>
                    </div>
                </td>
                <td><span class="badge badge-${status.toLowerCase().replace('-', '-')}">${status}</span></td>
                <td>
                    <div class="smart-criteria-cell" data-smart-tooltip="${escapeHtml(getSmartTooltip(kpi.smart))}">
                        <span class="smart-badge ${smartClass}">${smartStatus}</span>
                        <div class="smart-details">${smartDetails}</div>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm" onclick="viewKpiDetails(${kpi.id})" title="View Details">👁️</button>
                        <button class="btn btn-sm" onclick="editKpi(${kpi.id})" title="Edit KPI">✏️</button>
                        <button class="btn btn-sm" onclick="openDeleteModal(${kpi.id})" title="Delete KPI">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;

    tbody.querySelectorAll('.drag-handle').forEach(handle => {
        handle.textContent = '::';
    });

    tbody.querySelectorAll('.action-buttons .btn').forEach(button => {
        if (button.title === 'View Details') {
            button.textContent = 'View';
            button.classList.add('btn-secondary');
        } else if (button.title === 'Edit KPI') {
            button.textContent = 'Edit';
            button.classList.add('btn-secondary');
        } else if (button.title === 'Delete KPI') {
            button.textContent = 'Delete';
            button.classList.add('btn-danger');
        }
    });
    
    // Attach drag event listeners
    attachDragListeners();
    attachSmartTooltipListeners();
    updateSelectionUi(kpis);
}

// Populate year filter dropdown
function populateYearFilter() {
    const kpis = getKpiData();
    const years = [...new Set(kpis.map(kpi => {
        return getDateYear(kpi.endDate);
    }).filter(Number.isFinite))].sort((a, b) => b - a);
    
    const yearFilter = document.getElementById('yearFilter');
    const selectedYear = yearFilter.value;
    let html = '<option value="">All Years</option>';

    years.forEach(year => {
        html += `<option value="${year}">${year}</option>`;
    });
    
    yearFilter.innerHTML = html;
    
    if (years.includes(parseInt(selectedYear, 10))) {
        yearFilter.value = selectedYear;
    }
}

// Populate team filter dropdown
function populateTeamFilter() {
    const kpis = getKpiData();
    const teams = [...new Set(kpis.map(kpi => kpi.team))].sort((a, b) => a.localeCompare(b));
    const teamFilter = document.getElementById('teamFilter');
    const selectedTeam = teamFilter.value;
    let html = '<option value="">All Teams</option>';

    teams.forEach(team => {
        html += `<option value="${team}">${escapeHtml(team)}</option>`;
    });
    
    teamFilter.innerHTML = html;
    
    if (teams.includes(selectedTeam)) {
        teamFilter.value = selectedTeam;
    }
}

function populateOwnerFilter() {
    const kpis = getKpiData();
    const owners = [...new Set(kpis.map(kpi => kpi.owner))].sort((a, b) => a.localeCompare(b));
    const ownerFilter = document.getElementById('ownerFilter');
    const selectedOwner = ownerFilter.value;
    let html = '<option value="">All Owners</option>';

    owners.forEach(owner => {
        html += `<option value="${owner}">${escapeHtml(owner)}</option>`;
    });

    ownerFilter.innerHTML = html;

    if (owners.includes(selectedOwner)) {
        ownerFilter.value = selectedOwner;
    }
}

function populateAllFilters() {
    populateYearFilter();
    populateTeamFilter();
    populateOwnerFilter();
}

// ==========================================
// FILTER FUNCTIONS
// ==========================================

// Get filtered KPIs based on search and filters
function getFilteredKpis() {
    let kpis = getKpiData();
    
    // Search filter
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        kpis = kpis.filter(kpi => 
            kpi.name.toLowerCase().includes(searchTerm) ||
            kpi.owner.toLowerCase().includes(searchTerm) ||
            kpi.team.toLowerCase().includes(searchTerm)
        );
    }
    
    // Year filter
    const yearFilter = document.getElementById('yearFilter').value;
    if (yearFilter) {
        kpis = kpis.filter(kpi => {
            const year = getDateYear(kpi.endDate);
            return year === parseInt(yearFilter);
        });
    }
    
    // Team filter
    const teamFilter = document.getElementById('teamFilter').value;
    if (teamFilter) {
        kpis = kpis.filter(kpi => kpi.team === teamFilter);
    }

    // Owner filter
    const ownerFilter = document.getElementById('ownerFilter').value;
    if (ownerFilter) {
        kpis = kpis.filter(kpi => kpi.owner === ownerFilter);
    }
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter').value;
    if (statusFilter) {
        kpis = kpis.filter(kpi => {
            const progress = calculateProgress(kpi.actual, kpi.target);
            const status = getStatus(progress);
            return status === statusFilter;
        });
    }
    
    return kpis;
}

// Filter and re-render all sections
function filterAndRender() {
    hideSmartTooltip();
    renderDashboard();
    renderProgressOverview();
    renderKpiTable();
    updateResultSummary();
    renderActiveFilterChips();
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('yearFilter').value = '';
    document.getElementById('teamFilter').value = '';
    document.getElementById('ownerFilter').value = '';
    document.getElementById('statusFilter').value = '';
    filterAndRender();
}

function getActiveFilters() {
    const filters = [];
    const searchValue = document.getElementById('searchInput')?.value.trim();
    const yearValue = document.getElementById('yearFilter')?.value;
    const teamValue = document.getElementById('teamFilter')?.value;
    const ownerValue = document.getElementById('ownerFilter')?.value;
    const statusValue = document.getElementById('statusFilter')?.value;

    if (searchValue) {
        filters.push({ key: 'search', label: 'Search', value: searchValue });
    }
    if (yearValue) {
        filters.push({ key: 'year', label: 'Year', value: yearValue });
    }
    if (teamValue) {
        filters.push({ key: 'team', label: 'Team', value: teamValue });
    }
    if (ownerValue) {
        filters.push({ key: 'owner', label: 'Owner', value: ownerValue });
    }
    if (statusValue) {
        filters.push({ key: 'status', label: 'Status', value: statusValue });
    }

    return filters;
}

function clearFilterByKey(filterKey) {
    const filterTargets = {
        search: 'searchInput',
        year: 'yearFilter',
        team: 'teamFilter',
        owner: 'ownerFilter',
        status: 'statusFilter'
    };
    const targetId = filterTargets[filterKey];
    const target = targetId ? document.getElementById(targetId) : null;

    if (target) {
        target.value = '';
        filterAndRender();
        target.focus();
    }
}

function renderActiveFilterChips() {
    const chipContainer = document.getElementById('activeFilterChips');
    if (!chipContainer) {
        return;
    }

    const filters = getActiveFilters();
    chipContainer.innerHTML = filters.map(filter => `
        <button type="button" class="active-filter-chip" data-clear-filter="${filter.key}" aria-label="Clear ${escapeHtml(filter.label)} filter">
            <span>${escapeHtml(filter.label)}: ${escapeHtml(filter.value)}</span>
            <span aria-hidden="true">x</span>
        </button>
    `).join('');
}

function updateResultSummary() {
    const totalCount = getKpiData().length;
    const filteredCount = getFilteredKpis().length;
    const resultSummary = document.getElementById('resultSummary');

    if (!resultSummary) {
        return;
    }

    resultSummary.textContent = filteredCount === totalCount
        ? `${totalCount} KPI records`
        : `${filteredCount} of ${totalCount} KPI records`;
}

function pruneSelectedKpiIds() {
    const existingIds = new Set(getKpiData().map(kpi => kpi.id));
    selectedKpiIds = new Set([...selectedKpiIds].filter(id => existingIds.has(id)));
}

function handleTableSelectionChange(event) {
    if (!event.target.classList.contains('row-select-checkbox')) {
        return;
    }

    const kpiId = Number(event.target.dataset.kpiId);
    if (event.target.checked) {
        selectedKpiIds.add(kpiId);
    } else {
        selectedKpiIds.delete(kpiId);
    }

    const row = event.target.closest('tr');
    if (row) {
        row.classList.toggle('selected-row', event.target.checked);
    }

    updateSelectionUi(getFilteredKpis());
}

function handleTableHeaderChange(event) {
    if (event.target.id === 'selectAllCheckbox') {
        handleSelectAllToggle(event);
    }
}

function handleSelectAllToggle(event) {
    const visibleKpis = getFilteredKpis();
    visibleKpis.forEach(kpi => {
        if (event.target.checked) {
            selectedKpiIds.add(kpi.id);
        } else {
            selectedKpiIds.delete(kpi.id);
        }
    });

    renderKpiTable();
}

function updateSelectionUi(filteredKpis = getFilteredKpis()) {
    const selectedCount = selectedKpiIds.size;
    const selectionSummary = document.getElementById('selectionSummary');
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const visibleIds = filteredKpis.map(kpi => kpi.id);
    const selectedVisibleCount = visibleIds.filter(id => selectedKpiIds.has(id)).length;

    if (selectionSummary) {
        selectionSummary.textContent = selectedCount === 0
            ? 'No KPIs selected'
            : `${selectedCount} selected`;
    }

    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = selectedCount === 0;
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.disabled = visibleIds.length === 0;
        selectAllCheckbox.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
        selectAllCheckbox.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
    }
}

function handleBulkDelete() {
    if (selectedKpiIds.size === 0) {
        return;
    }

    openDeleteModal([...selectedKpiIds]);
}

function toggleProgressOverview() {
    isProgressOverviewExpanded = !isProgressOverviewExpanded;
    renderProgressOverview();
}

function handleProgressOverviewSortChange(event) {
    progressOverviewSort = event.target.value || 'status-priority';
    renderProgressOverview();
}

function setProgressOverviewView(view) {
    progressOverviewView = view === 'list' ? 'list' : 'grid';
    updateProgressOverviewViewButtons();
    renderProgressOverview();
}

function updateProgressOverviewViewButtons() {
    document.querySelectorAll('.progress-view-btn').forEach(button => {
        button.classList.toggle('is-active', button.dataset.view === progressOverviewView);
    });
}

function getProgressOverviewLimit() {
    if (progressOverviewView === 'list') {
        if (window.innerWidth <= 760) {
            return 2;
        }

        if (window.innerWidth <= 1100) {
            return 3;
        }

        return 4;
    }

    if (window.innerWidth <= 760) {
        return 2;
    }

    if (window.innerWidth <= 1100) {
        return 4;
    }

    return 6;
}

// Progress overview sorting keeps the current filtered KPI set readable when the section gets busy.
function getSortedProgressOverviewKpis() {
    const kpis = [...getFilteredKpis()];
    const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

    const compareByText = (left, right, key) => collator.compare(String(left[key] || ''), String(right[key] || ''));
    const compareByDueDate = (left, right) => {
        const leftDate = normalizeDateValue(left.endDate) || '9999-12-31';
        const rightDate = normalizeDateValue(right.endDate) || '9999-12-31';
        return leftDate.localeCompare(rightDate);
    };
    const compareByProgress = (left, right) => calculateProgress(left.actual, left.target) - calculateProgress(right.actual, right.target);
    const compareByStatusPriority = (left, right) => getProgressStatusPriority(left) - getProgressStatusPriority(right);
    const compareByWeight = (left, right) => getProgressCardWeight(right) - getProgressCardWeight(left);

    kpis.sort((left, right) => {
        switch (progressOverviewSort) {
            case 'progress-low-high':
                return compareByProgress(left, right) || compareByText(left, right, 'name');
            case 'progress-high-low':
                return compareByProgress(right, left) || compareByText(left, right, 'name');
            case 'name-asc':
                return compareByText(left, right, 'name');
            case 'name-desc':
                return compareByText(right, left, 'name');
            case 'owner-asc':
                return compareByText(left, right, 'owner') || compareByText(left, right, 'name');
            case 'team-asc':
                return compareByText(left, right, 'team') || compareByText(left, right, 'name');
            case 'due-date-asc':
                return compareByDueDate(left, right) || compareByStatusPriority(left, right);
            case 'weight-desc':
                return compareByWeight(left, right) || compareByStatusPriority(left, right) || compareByText(left, right, 'name');
            case 'status-priority':
            default:
                return compareByStatusPriority(left, right) || compareByProgress(left, right) || compareByDueDate(left, right);
        }
    });

    return kpis;
}

function getProgressStatusPriority(kpi) {
    const progress = calculateProgress(kpi.actual, kpi.target);
    const status = getStatus(progress);
    const priorities = {
        'Off-track': 0,
        'At-risk': 1,
        'On-track': 2,
        'Completed': 3
    };

    return priorities[status] ?? 4;
}

function getProgressSortLabel() {
    const progressSortControl = document.getElementById('progressSortControl');
    const selectedOption = progressSortControl?.selectedOptions?.[0];
    return selectedOption ? selectedOption.textContent.trim() : 'Status priority';
}

// Progress overview card metadata keeps the cards useful without overloading the layout.
function getProgressCardCategory(kpi) {
    return String(kpi.department || kpi.team || 'General').trim();
}

function getProgressCardWeight(kpi) {
    const value = Number(kpi.weight);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function getProgressCardWeightMarkup(kpi) {
    const weight = getProgressCardWeight(kpi);
    return weight > 0
        ? `<span class="progress-meta-chip">Weight ${escapeHtml(weight)}%</span>`
        : '';
}

function formatProgressMetricValue(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return '-';
    }

    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
    }).format(numericValue);
}

function getProgressStatusClass(status) {
    return status.toLowerCase().replace(/[^a-z]+/g, '-');
}

function isProgressKpiUrgent(kpi, status) {
    if (status === 'Completed') {
        return false;
    }

    const dueDate = normalizeDateValue(kpi.endDate);
    if (!dueDate) {
        return false;
    }

    const today = normalizeDateValue(new Date());
    if (!today) {
        return false;
    }

    const dueTime = new Date(`${dueDate}T00:00:00`).getTime();
    const todayTime = new Date(`${today}T00:00:00`).getTime();
    const daysUntilDue = Math.ceil((dueTime - todayTime) / (1000 * 60 * 60 * 24));

    return daysUntilDue <= 30;
}

// ==========================================
// MODAL FUNCTIONS
// ==========================================

function showFormFeedback(message, targetId) {
    const feedback = document.getElementById('formFeedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.add('is-visible');

    if (targetId) {
        const target = document.getElementById(targetId);
        if (target && typeof target.focus === 'function') {
            target.focus();
        }
    }
}

function clearFormFeedback() {
    const feedback = document.getElementById('formFeedback');
    if (!feedback) return;
    feedback.textContent = '';
    feedback.hidden = true;
    feedback.classList.remove('is-visible');
}

function showAppStatus(message, type = 'info') {
    const status = document.getElementById('appStatus');
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.dataset.type = type;

    window.clearTimeout(showAppStatus.timeoutId);
    showAppStatus.timeoutId = window.setTimeout(() => {
        status.hidden = true;
        status.textContent = '';
        delete status.dataset.type;
    }, 5200);
}

function getActiveModal() {
    return document.querySelector('.modal.active');
}

function handleGlobalKeydown(event) {
    const activeModal = getActiveModal();
    if (activeModal) {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeActiveModal(activeModal);
            return;
        }

        if (event.key === 'Tab') {
            trapModalFocus(event, activeModal);
        }

        return;
    }

    handleRowMenuKeydown(event);
}

function closeActiveModal(modalElement) {
    if (!modalElement) return;
    if (modalElement.id === 'kpiModal') closeModal();
    if (modalElement.id === 'deleteModal') closeDeleteModal();
    if (modalElement.id === 'detailModal') closeDetailModal();
}

function setPageInert(isInert) {
    const page = document.querySelector('.container');
    if (!page) return;

    if (isInert) {
        page.setAttribute('aria-hidden', 'true');
        page.inert = true;
    } else {
        page.removeAttribute('aria-hidden');
        page.inert = false;
    }
}

function openModalElement(modalElement) {
    if (!modalElement) return;
    setPageInert(true);
    modalElement.classList.add('active');
    modalElement.setAttribute('aria-hidden', 'false');
    focusFirstModalControl(modalElement);
}

function closeModalElement(modalElement) {
    if (!modalElement) return;
    modalElement.classList.remove('active');
    modalElement.setAttribute('aria-hidden', 'true');
    if (!getActiveModal()) {
        setPageInert(false);
    }
}

function getFocusableElements(root) {
    return [...root.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter(element => element.offsetParent !== null || element === document.activeElement);
}

function trapModalFocus(event, modalElement) {
    const focusableElements = getFocusableElements(modalElement);
    if (focusableElements.length === 0) {
        event.preventDefault();
        modalElement.focus();
        return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
}

// Open add KPI modal
function openAddModal() {
    rememberFocusBeforeModal();
    editingKpiId = null;
    document.getElementById('modalTitle').textContent = 'Add New KPI';
    document.getElementById('kpiForm').reset();
    clearFormFeedback();
    setDefaultFormDates();
    setDefaultEvaluationFields();
    document.getElementById('smartWarning').style.display = 'none';
    const modal = document.getElementById('kpiModal');
    const modalForm = modal?.querySelector('.modal-form');
    if (modalForm) {
        modalForm.classList.add('is-create-mode');
    }
    openModalElement(modal);
}

// Open edit KPI modal
function editKpi(id) {
    const kpi = getKpiById(id);
    if (!kpi) return;
    
    rememberFocusBeforeModal();
    clearFormFeedback();
    shouldSyncFinalRatingToGuide = false;
    editingKpiId = id;
    document.getElementById('modalTitle').textContent = 'Edit KPI';
    
    // Fill form with KPI data
    document.getElementById('kpiName').value = kpi.name;
    document.getElementById('kpiOwner').value = kpi.owner;
    document.getElementById('kpiTeam').value = kpi.team;
    document.getElementById('kpiDepartment').value = kpi.department;
    document.getElementById('kpiTarget').value = kpi.target;
    document.getElementById('kpiLastYearResult').value = kpi.lastYearResult ?? '';
    document.getElementById('kpiActual').value = kpi.actual;
    document.getElementById('kpiUnit').value = kpi.unit;
    document.getElementById('kpiStartDate').value = kpi.startDate;
    document.getElementById('kpiEndDate').value = kpi.endDate;
    document.getElementById('kpiRatingGrade').value = String(kpi.ratingGrade);
    document.getElementById('rating2Min').value = String(kpi.ratingCriteria.rating2Min);
    document.getElementById('rating3Min').value = String(kpi.ratingCriteria.rating3Min);
    document.getElementById('rating4Min').value = String(kpi.ratingCriteria.rating4Min);
    document.getElementById('rating5Min').value = String(kpi.ratingCriteria.rating5Min);
    document.getElementById('kpiRatingJustification').value = kpi.ratingJustification || '';
    document.getElementById('kpiMidYearComment').value = kpi.midYearComment || '';
    document.getElementById('kpiYearEndComment').value = kpi.yearEndComment || '';
    document.getElementById('kpiRemark').value = kpi.remark;
    
    // Fill SMART criteria
    if (kpi.smart) {
        document.getElementById('smartSpecific').value = kpi.smart.specific || '';
        document.getElementById('smartMeasurable').value = kpi.smart.measurable || '';
        document.getElementById('smartAchievable').value = kpi.smart.achievable || '';
        document.getElementById('smartRelevant').value = kpi.smart.relevant || '';
        document.getElementById('smartTimeBound').value = kpi.smart.timeBound || '';
    }
    
    checkSmartCriteria();
    updateRatingSuggestion();
    const modal = document.getElementById('kpiModal');
    const modalForm = modal?.querySelector('.modal-form');
    if (modalForm) {
        modalForm.classList.remove('is-create-mode');
    }
    openModalElement(modal);
}

// Close KPI modal
function closeModal() {
    closeModalElement(document.getElementById('kpiModal'));
    editingKpiId = null;
    shouldSyncFinalRatingToGuide = true;
    clearFormFeedback();
    restoreFocusAfterModal();
}

// Open delete confirmation modal
function openDeleteModal(id) {
    rememberFocusBeforeModal();
    pendingDeleteIds = Array.isArray(id) ? id : [id];
    editingKpiId = pendingDeleteIds.length === 1 ? pendingDeleteIds[0] : null;
    document.getElementById('deleteModalTitle').textContent = pendingDeleteIds.length === 1
        ? 'Delete KPI'
        : `Delete ${pendingDeleteIds.length} KPIs`;
    document.getElementById('deleteModalMessage').textContent = pendingDeleteIds.length === 1
        ? 'Are you sure you want to delete this KPI? This action cannot be undone.'
        : `Are you sure you want to delete ${pendingDeleteIds.length} selected KPIs? This action cannot be undone.`;
    document.getElementById('confirmDeleteBtn').textContent = pendingDeleteIds.length === 1
        ? 'Delete KPI'
        : `Delete ${pendingDeleteIds.length} KPIs`;
    const modal = document.getElementById('deleteModal');
    openModalElement(modal);
}

// Close delete confirmation modal
function closeDeleteModal() {
    closeModalElement(document.getElementById('deleteModal'));
    pendingDeleteIds = [];
    editingKpiId = null;
    restoreFocusAfterModal();
}

// Close detail modal
function closeDetailModal() {
    closeModalElement(document.getElementById('detailModal'));
    editingKpiId = null;
    restoreFocusAfterModal();
}

// View KPI details
function viewKpiDetails(id) {
    const kpi = getKpiById(id);
    if (!kpi) return;
    rememberFocusBeforeModal();

    editingKpiId = id;
    const progress = calculateProgress(kpi.actual, kpi.target);
    const status = getStatus(progress);
    const smartStatus = isSmartComplete(kpi.smart) ? '✅ Complete' : '❌ Incomplete';
    
    document.getElementById('detailModalTitle').textContent = kpi.name;
    
    let smartDetails = '';
    if (kpi.smart) {
        smartDetails = `
            <div class="detail-smart-section">
                <h4>SMART Criteria (${isSmartComplete(kpi.smart) ? 'Complete' : 'Incomplete'})</h4>
                <div class="detail-smart-grid">
                    ${kpi.smart.specific ? `<div class="smart-item"><strong>Specific:</strong> ${escapeHtml(kpi.smart.specific)}</div>` : ''}
                    ${kpi.smart.measurable ? `<div class="smart-item"><strong>Measurable:</strong> ${escapeHtml(kpi.smart.measurable)}</div>` : ''}
                    ${kpi.smart.achievable ? `<div class="smart-item"><strong>Achievable:</strong> ${escapeHtml(kpi.smart.achievable)}</div>` : ''}
                    ${kpi.smart.relevant ? `<div class="smart-item"><strong>Relevant:</strong> ${escapeHtml(kpi.smart.relevant)}</div>` : ''}
                    ${kpi.smart.timeBound ? `<div class="smart-item"><strong>Time-bound:</strong> ${escapeHtml(kpi.smart.timeBound)}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    const detailHTML = `
        <div class="detail-grid">
            <div class="detail-row">
                <span class="detail-label">KPI Name:</span>
                <span class="detail-value">${escapeHtml(kpi.name)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Owner:</span>
                <span class="detail-value">${escapeHtml(kpi.owner)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Team:</span>
                <span class="detail-value">${escapeHtml(kpi.team)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Department:</span>
                <span class="detail-value">${escapeHtml(kpi.department || '-')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value"><span class="badge badge-${status.toLowerCase().replace('-', '-')}">${status}</span></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Progress:</span>
                <span class="detail-value">${Math.round(progress)}%</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Target:</span>
                <span class="detail-value">${kpi.target} ${kpi.unit}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Actual:</span>
                <span class="detail-value">${kpi.actual} ${kpi.unit}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Start Date:</span>
                <span class="detail-value">${formatDisplayDate(kpi.startDate)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">End Date:</span>
                <span class="detail-value">${formatDisplayDate(kpi.endDate)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Remark:</span>
                <span class="detail-value">${escapeHtml(kpi.remark || '-')}</span>
            </div>
        </div>
        <div class="detail-progress-section">
            <h4>Progress Bar</h4>
            <div class="progress-bar" style="height: 12px;">
                <div class="progress-fill" style="transform: scaleX(${Math.min(progress, 100) / 100}); background: ${getProgressColor(status)};"></div>
            </div>
        </div>
        ${smartDetails}
    `;
    
    document.getElementById('detailContent').innerHTML = detailHTML;
    const detailModal = document.getElementById('detailModal');
    detailModal.classList.add('active');
    focusFirstModalControl(detailModal);
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Get form values
    const kpiData = {
        name: document.getElementById('kpiName').value.trim(),
        owner: document.getElementById('kpiOwner').value.trim(),
        team: document.getElementById('kpiTeam').value.trim(),
        department: document.getElementById('kpiDepartment').value.trim(),
        target: parseFloat(document.getElementById('kpiTarget').value),
        lastYearResult: normalizeOptionalNumberValue(document.getElementById('kpiLastYearResult').value),
        actual: parseFloat(document.getElementById('kpiActual').value),
        unit: document.getElementById('kpiUnit').value.trim(),
        startDate: normalizeDateValue(document.getElementById('kpiStartDate').value),
        endDate: normalizeDateValue(document.getElementById('kpiEndDate').value),
        ratingGrade: normalizeRatingGrade(document.getElementById('kpiRatingGrade').value),
        ratingCriteria: getCurrentFormRatingCriteria(),
        ratingJustification: document.getElementById('kpiRatingJustification').value.trim(),
        midYearComment: document.getElementById('kpiMidYearComment').value.trim(),
        yearEndComment: document.getElementById('kpiYearEndComment').value.trim(),
        remark: document.getElementById('kpiRemark').value.trim(),
        smart: {
            specific: document.getElementById('smartSpecific').value.trim(),
            measurable: document.getElementById('smartMeasurable').value.trim(),
            achievable: document.getElementById('smartAchievable').value.trim(),
            relevant: document.getElementById('smartRelevant').value.trim(),
            timeBound: document.getElementById('smartTimeBound').value.trim()
        }
    };
    
    // Validate form
    if (!kpiData.name || !kpiData.owner || !kpiData.team || !kpiData.unit || !kpiData.startDate || !kpiData.endDate) {
        const firstMissingId = [
            ['kpiName', kpiData.name],
            ['kpiOwner', kpiData.owner],
            ['kpiTeam', kpiData.team],
            ['kpiUnit', kpiData.unit],
            ['kpiStartDate', kpiData.startDate],
            ['kpiEndDate', kpiData.endDate]
        ].find(([, value]) => !value)?.[0];
        showFormFeedback('Fill in all required fields marked with an asterisk before saving.', firstMissingId);
        return;
    }

    if (kpiData.startDate > kpiData.endDate) {
        showFormFeedback('End date must be the same as or later than the start date.', 'kpiEndDate');
        return;
    }

    if (kpiData.ratingGrade < 1 || kpiData.ratingGrade > 5) {
        showFormFeedback('Select a rating from 1 to 5.', 'kpiRatingGrade');
        return;
    }

    if (!isValidRatingCriteria(kpiData.ratingCriteria)) {
        showFormFeedback('Keep the rating ranges in ascending order: Rating 2 < Rating 3 < Rating 4 < Rating 5.', 'rating2Min');
        return;
    }

    const ratingComparison = getRatingComparisonState(
        kpiData.actual,
        kpiData.target,
        kpiData.ratingCriteria,
        kpiData.ratingGrade
    );

    if (ratingComparison.hasMismatch && !kpiData.ratingJustification) {
        showFormFeedback('Add a short justification when the final rating differs from the rating guide.', 'kpiRatingJustification');
        return;
    }
    
    try {
        // Add or update KPI
        if (editingKpiId) {
            await updateKpi(editingKpiId, kpiData);
            showAppStatus('KPI updated.', 'success');
        } else {
            await addKpi(kpiData);
            showAppStatus('KPI added.', 'success');
        }

        // Reset and refresh UI
        closeModal();
        document.getElementById('kpiForm').reset();
        setDefaultFormDates();
        setDefaultEvaluationFields();
        refreshUi({ refreshFilters: true });
    } catch (error) {
        handlePersistenceError('Could not save the KPI to Supabase.', error);
    }
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

// Export the currently filtered KPI list as a CSV file
function exportKpisAsCsv() {
    const rows = getExportRows();
    if (rows.length === 0) {
        showAppStatus('There is no KPI data to export.', 'warning');
        return;
    }
    
    const headers = Object.keys(rows[0]);
    const csvLines = [
        headers.join(','),
        ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
    ];
    
    const csvContent = '\uFEFF' + csvLines.join('\n');
    downloadFile(csvContent, `team-kpi-report-${getTodayFileDate()}.csv`, 'text/csv;charset=utf-8;');
    showAppStatus(`Exported ${rows.length} KPI records.`, 'success');
}

// Build export rows from the currently filtered KPI list
function getExportRows() {
    const kpis = getFilteredKpis();
    
    return kpis.map(kpi => {
        const progress = calculateProgress(kpi.actual, kpi.target);
        const status = getStatus(progress);
        
        return {
            'KPI ID': kpi.id,
            'KPI Name': kpi.name,
            'Owner': kpi.owner,
            'Team': kpi.team,
            'Department': kpi.department || '',
            'Target': kpi.target,
            'Last Year Result': kpi.lastYearResult ?? '',
            'Actual': kpi.actual,
            'Unit': kpi.unit,
            'Progress %': Math.round(progress),
            'Status': status,
            'Rating Grade': kpi.ratingGrade,
            'Rating Label': getRatingMeta(kpi.ratingGrade).label,
            'Rating 2 Starts At %': kpi.ratingCriteria.rating2Min,
            'Rating 3 Starts At %': kpi.ratingCriteria.rating3Min,
            'Rating 4 Starts At %': kpi.ratingCriteria.rating4Min,
            'Rating 5 Starts At %': kpi.ratingCriteria.rating5Min,
            'Rating Justification': kpi.ratingJustification || '',
            'Mid-Year Comment': kpi.midYearComment || '',
            'Year-End Comment': kpi.yearEndComment || '',
            'SMART Status': isSmartComplete(kpi.smart) ? 'Complete' : 'Incomplete',
            'Specific': kpi.smart?.specific || '',
            'Measurable': kpi.smart?.measurable || '',
            'Achievable': kpi.smart?.achievable || '',
            'Relevant': kpi.smart?.relevant || '',
            'Time-bound': kpi.smart?.timeBound || '',
            'Start Date': kpi.startDate,
            'End Date': kpi.endDate,
            'Remark': kpi.remark || '',
            'Created At': kpi.createdAt || '',
            'Updated At': kpi.updatedAt || ''
        };
    });
}

// Download text content as a file in the browser
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const fileUrl = URL.createObjectURL(blob);
    
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(fileUrl);
}

// Escape CSV values that contain commas, quotes, or line breaks
function csvEscape(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

// Use today's date in exported file names
function getTodayFileDate() {
    return new Date().toISOString().split('T')[0];
}

// Import a CSV file and update KPI records in bulk
function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = async loadEvent => {
        try {
            const fileContent = String(loadEvent.target.result || '');
            const importedRows = getImportedRows(file.name, fileContent);
            const summary = await importKpiRows(importedRows);
            
            refreshUi({ refreshFilters: true });
            
            const messageLines = [
                'Import completed successfully.',
                `Added: ${summary.added}`,
                `Updated: ${summary.updated}`,
                `Skipped: ${summary.skipped}`
            ];
            
            if (summary.errors.length > 0) {
                messageLines.push('');
                messageLines.push('Example skipped rows:');
                summary.errors.slice(0, 3).forEach(error => messageLines.push(error));
            }
            
            showAppStatus(messageLines.join(' '), summary.errors.length > 0 ? 'warning' : 'success');
        } catch (error) {
            showAppStatus('Import failed. Please use a CSV file exported from this app.', 'error');
        } finally {
            event.target.value = '';
        }
    };
    
    reader.onerror = () => {
        showAppStatus('The selected file could not be read.', 'error');
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

// Choose the correct parser based on the imported file type
function getImportedRows(fileName, fileContent) {
    const lowerFileName = fileName.toLowerCase();
    
    if (lowerFileName.endsWith('.csv')) {
        return parseCsvToObjects(fileContent);
    }
    
    throw new Error('Unsupported file type');
}

// Parse CSV text into an array of row objects
function parseCsvToObjects(csvText) {
    const cleanText = String(csvText || '').replace(/^\uFEFF/, '');
    const rows = [];
    let currentRow = [];
    let currentValue = '';
    let insideQuotes = false;
    
    for (let index = 0; index < cleanText.length; index++) {
        const character = cleanText[index];
        const nextCharacter = cleanText[index + 1];
        
        if (character === '"') {
            if (insideQuotes && nextCharacter === '"') {
                currentValue += '"';
                index++;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }
        
        if (character === ',' && !insideQuotes) {
            currentRow.push(currentValue);
            currentValue = '';
            continue;
        }
        
        if ((character === '\n' || character === '\r') && !insideQuotes) {
            if (character === '\r' && nextCharacter === '\n') {
                index++;
            }
            currentRow.push(currentValue);
            rows.push(currentRow);
            currentRow = [];
            currentValue = '';
            continue;
        }
        
        currentValue += character;
    }
    
    currentRow.push(currentValue);
    if (currentRow.some(value => String(value).trim() !== '')) {
        rows.push(currentRow);
    }
    
    return convertRowsToObjects(rows);
}

// Convert a matrix of values into objects using the first row as headers
function convertRowsToObjects(rows) {
    if (!rows.length) {
        return [];
    }
    
    const headers = rows[0].map(header => String(header || '').trim());
    
    return rows
        .slice(1)
        .filter(row => row.some(cell => String(cell || '').trim() !== ''))
        .map(row => {
            const objectRow = {};
            
            headers.forEach((header, index) => {
                objectRow[header] = String(row[index] ?? '').trim();
            });
            
            return objectRow;
        });
}

// Import rows into Supabase by updating matches or adding new KPIs
async function importKpiRows(rows) {
    const kpis = getKpiData();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    
    rows.forEach((row, index) => {
        const normalizedRow = normalizeImportedKpi(row);
        
        if (!normalizedRow.isValid) {
            skipped++;
            errors.push(`Row ${index + 2}: ${normalizedRow.error}`);
            return;
        }
        
        const importedKpi = normalizedRow.kpi;
        const existingIndex = findImportedKpiIndex(kpis, importedKpi);
        
        if (existingIndex !== -1) {
            kpis[existingIndex] = {
                ...kpis[existingIndex],
                ...importedKpi,
                id: kpis[existingIndex].id
            };
            updated++;
        } else {
            kpis.push({
                ...importedKpi,
                id: importedKpi.id ?? Date.now() + added + updated + skipped
            });
            added++;
        }
    });
    
    await saveKpiData(kpis);
    
    return {
        added,
        updated,
        skipped,
        errors
    };
}

// Normalize imported row values into the KPI structure used by the app
function normalizeImportedKpi(row) {
    const normalizedRow = {};
    
    Object.keys(row).forEach(key => {
        normalizedRow[normalizeImportHeaderKey(key)] = row[key];
    });
    
    const name = getImportTextValue(normalizedRow, 'kpiname');
    const owner = getImportTextValue(normalizedRow, 'owner');
    const team = getImportTextValue(normalizedRow, 'team');
    const department = getImportTextValue(normalizedRow, 'department');
    const unit = getImportTextValue(normalizedRow, 'unit');
    const startDate = getImportDateValue(normalizedRow, 'startdate');
    const endDate = getImportDateValue(normalizedRow, 'enddate');
    const remark = getImportTextValue(normalizedRow, 'remark');
    const midYearComment = getImportTextValue(normalizedRow, 'midyearcomment');
    const yearEndComment = getImportTextValue(normalizedRow, 'yearendcomment');
    const ratingJustification = getImportTextValue(normalizedRow, 'ratingjustification');
    const target = getImportNumberValue(normalizedRow, 'target');
    const lastYearResult = getImportNumberValue(normalizedRow, 'lastyearresult', null);
    const actual = getImportNumberValue(normalizedRow, 'actual', 0);
    const ratingGrade = normalizeRatingGrade(getImportNumberValue(normalizedRow, 'ratinggrade', 3));
    const ratingCriteria = normalizeRatingCriteria({
        rating2Min: getImportNumberValue(normalizedRow, 'rating2startsat', DEFAULT_RATING_CRITERIA.rating2Min),
        rating3Min: getImportNumberValue(normalizedRow, 'rating3startsat', DEFAULT_RATING_CRITERIA.rating3Min),
        rating4Min: getImportNumberValue(normalizedRow, 'rating4startsat', DEFAULT_RATING_CRITERIA.rating4Min),
        rating5Min: getImportNumberValue(normalizedRow, 'rating5startsat', DEFAULT_RATING_CRITERIA.rating5Min)
    });
    const rawImportedId = getImportNumberValue(normalizedRow, 'kpiid', null);
    const importedId = Number.isFinite(rawImportedId) ? rawImportedId : null;
    const createdAt = normalizeTimestampValue(getImportTextValue(normalizedRow, 'createdat'));
    const updatedAt = normalizeTimestampValue(getImportTextValue(normalizedRow, 'updatedat'));
    
    if (!name || !owner || !team || !unit || !startDate || !endDate) {
        return {
            isValid: false,
            error: 'Missing one or more required fields'
        };
    }
    
    if (!Number.isFinite(target)) {
        return {
            isValid: false,
            error: 'Target must be a number'
        };
    }
    
    if (!Number.isFinite(actual)) {
        return {
            isValid: false,
            error: 'Actual must be a number'
        };
    }

    if (!isValidRatingCriteria(ratingCriteria)) {
        return {
            isValid: false,
            error: 'Rating criteria must be in ascending order'
        };
    }

    if (startDate > endDate) {
        return {
            isValid: false,
            error: 'End date must be on or after the start date'
        };
    }
    
    return {
        isValid: true,
        kpi: {
            id: importedId,
            name,
            owner,
            team,
            department,
            target,
            lastYearResult: Number.isFinite(lastYearResult) ? lastYearResult : null,
            actual,
            unit,
            startDate,
            endDate,
            ratingGrade,
            ratingCriteria,
            ratingJustification,
            midYearComment,
            yearEndComment,
            remark,
            createdAt,
            updatedAt,
            smart: {
                specific: getImportTextValue(normalizedRow, 'specific'),
                measurable: getImportTextValue(normalizedRow, 'measurable'),
                achievable: getImportTextValue(normalizedRow, 'achievable'),
                relevant: getImportTextValue(normalizedRow, 'relevant'),
                timeBound: getImportTextValue(normalizedRow, 'timebound')
            }
        }
    };
}

// Find an existing KPI to update using KPI ID first, then name-owner-team
function findImportedKpiIndex(kpis, importedKpi) {
    if (Number.isFinite(importedKpi.id)) {
        const indexById = kpis.findIndex(kpi => kpi.id === importedKpi.id);
        if (indexById !== -1) {
            return indexById;
        }
    }
    
    return kpis.findIndex(kpi => {
        return kpi.name.trim().toLowerCase() === importedKpi.name.trim().toLowerCase() &&
            kpi.owner.trim().toLowerCase() === importedKpi.owner.trim().toLowerCase() &&
            kpi.team.trim().toLowerCase() === importedKpi.team.trim().toLowerCase();
    });
}

// Read text fields from an imported row
function getImportTextValue(row, key) {
    return String(row[key] ?? '').trim();
}

function getImportDateValue(row, key) {
    return normalizeDateValue(row[key]);
}

// Read number fields from an imported row
function getImportNumberValue(row, key, emptyFallback = NaN) {
    const value = String(row[key] ?? '').trim();
    
    if (!value) {
        return emptyFallback;
    }
    
    const cleanedValue = value.replace(/,/g, '').replace(/%/g, '');
    const parsedNumber = Number(cleanedValue);
    return Number.isFinite(parsedNumber) ? parsedNumber : NaN;
}

function normalizeImportHeaderKey(key) {
    return String(key ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeSmartCriteria(smart) {
    return {
        specific: String(smart?.specific || '').trim(),
        measurable: String(smart?.measurable || '').trim(),
        achievable: String(smart?.achievable || '').trim(),
        relevant: String(smart?.relevant || '').trim(),
        timeBound: String(smart?.timeBound || '').trim()
    };
}

function normalizeStoredKpiRecord(kpi) {
    const startDate = normalizeDateValue(kpi.startDate);
    const endDate = normalizeDateValue(kpi.endDate);
    const sortOrder = Number(kpi.sortOrder);

    return {
        ...kpi,
        startDate: startDate || String(kpi.startDate ?? '').trim(),
        endDate: endDate || String(kpi.endDate ?? '').trim(),
        lastYearResult: normalizeOptionalNumberValue(kpi.lastYearResult),
        ratingGrade: normalizeRatingGrade(kpi.ratingGrade),
        ratingCriteria: normalizeRatingCriteria(kpi.ratingCriteria),
        ratingJustification: String(kpi.ratingJustification || '').trim(),
        midYearComment: String(kpi.midYearComment || '').trim(),
        yearEndComment: String(kpi.yearEndComment || '').trim(),
        createdAt: normalizeTimestampValue(kpi.createdAt),
        updatedAt: normalizeTimestampValue(kpi.updatedAt),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        smart: normalizeSmartCriteria(kpi.smart)
    };
}

function normalizeRatingGrade(value) {
    const grade = Math.round(Number(value));
    return Number.isInteger(grade) && grade >= 1 && grade <= 5 ? grade : 3;
}

function normalizeOptionalNumberValue(value) {
    const text = String(value ?? '').trim();
    if (!text) {
        return null;
    }

    const numericValue = Number(text);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeTimestampValue(value) {
    const text = String(value ?? '').trim();
    if (!text) {
        return '';
    }

    const parsedDate = new Date(text);
    return Number.isNaN(parsedDate.getTime()) ? text : formatTimestampForStorage(parsedDate);
}

// Keep audit timestamps aligned to the business timezone.
function formatTimestampForStorage(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const parts = getBusinessDateTimeParts(date);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${BUSINESS_TIMEZONE_OFFSET}`;
}

function getCurrentBusinessTimestamp() {
    return formatTimestampForStorage(new Date());
}

function getBusinessDateTimeParts(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23'
    }).formatToParts(date);

    return parts.reduce((accumulator, part) => {
        if (part.type !== 'literal') {
            accumulator[part.type] = part.value;
        }
        return accumulator;
    }, {});
}

function getDefaultRatingCriteria() {
    return {
        rating2Min: DEFAULT_RATING_CRITERIA.rating2Min,
        rating3Min: DEFAULT_RATING_CRITERIA.rating3Min,
        rating4Min: DEFAULT_RATING_CRITERIA.rating4Min,
        rating5Min: DEFAULT_RATING_CRITERIA.rating5Min
    };
}

function normalizeRatingCriteria(criteria) {
    const defaults = getDefaultRatingCriteria();

    return {
        rating2Min: normalizeThresholdValue(criteria?.rating2Min, defaults.rating2Min),
        rating3Min: normalizeThresholdValue(criteria?.rating3Min, defaults.rating3Min),
        rating4Min: normalizeThresholdValue(criteria?.rating4Min, defaults.rating4Min),
        rating5Min: normalizeThresholdValue(criteria?.rating5Min, defaults.rating5Min)
    };
}

function normalizeThresholdValue(value, fallback) {
    const numericValue = Math.round(Number(value));
    return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
}

function isValidRatingCriteria(criteria) {
    const normalizedCriteria = normalizeRatingCriteria(criteria);
    return normalizedCriteria.rating2Min < normalizedCriteria.rating3Min &&
        normalizedCriteria.rating3Min < normalizedCriteria.rating4Min &&
        normalizedCriteria.rating4Min < normalizedCriteria.rating5Min;
}

function normalizeDateValue(value) {
    const text = String(value ?? '').trim();
    if (!text) {
        return '';
    }

    const normalizedText = text.replace(/\./g, '/');
    const isoMatch = normalizedText.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        return buildIsoDate(isoMatch[1], isoMatch[2], isoMatch[3]);
    }

    const dayFirstMatch = normalizedText.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dayFirstMatch) {
        return buildIsoDate(dayFirstMatch[3], dayFirstMatch[2], dayFirstMatch[1]);
    }

    const parsedDate = new Date(normalizedText);
    if (!Number.isNaN(parsedDate.getTime())) {
        return buildIsoDate(
            parsedDate.getFullYear(),
            parsedDate.getMonth() + 1,
            parsedDate.getDate()
        );
    }

    return '';
}

function buildIsoDate(year, month, day) {
    const yyyy = String(year).padStart(4, '0');
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const testDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (Number.isNaN(testDate.getTime())) {
        return '';
    }

    if (testDate.getFullYear() !== Number(yyyy) || testDate.getMonth() + 1 !== Number(mm) || testDate.getDate() !== Number(dd)) {
        return '';
    }

    return `${yyyy}-${mm}-${dd}`;
}

function getDateYear(value) {
    const isoDate = normalizeDateValue(value);
    return isoDate ? Number(isoDate.slice(0, 4)) : NaN;
}

function formatDisplayDate(value) {
    const isoDate = normalizeDateValue(value);
    if (!isoDate) {
        return '-';
    }

    const [year, month, day] = isoDate.split('-').map(Number);
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${shortMonths[month - 1]} ${year}`;
}

function formatDisplayDateTime(value) {
    const text = String(value ?? '').trim();
    if (!text) {
        return '-';
    }

    const parsedDate = new Date(text);
    if (Number.isNaN(parsedDate.getTime())) {
        return text;
    }

    const formattedValue = parsedDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: BUSINESS_TIMEZONE
    });

    return `${formattedValue} ${BUSINESS_TIMEZONE_LABEL}`;
}

function setDefaultEvaluationFields() {
    shouldSyncFinalRatingToGuide = true;
    const ratingInput = document.getElementById('kpiRatingGrade');
    if (ratingInput) {
        ratingInput.value = '3';
    }

    const justificationInput = document.getElementById('kpiRatingJustification');
    if (justificationInput) {
        justificationInput.value = '';
        justificationInput.required = false;
    }

    const defaultCriteria = getDefaultRatingCriteria();
    const thresholdInputs = {
        rating2Min: document.getElementById('rating2Min'),
        rating3Min: document.getElementById('rating3Min'),
        rating4Min: document.getElementById('rating4Min'),
        rating5Min: document.getElementById('rating5Min')
    };

    Object.entries(thresholdInputs).forEach(([key, input]) => {
        if (input) {
            input.value = String(defaultCriteria[key]);
        }
    });

    updateRatingSuggestion();
    updateEvaluationContextPanel();
}

function handleRatingGradeChange() {
    shouldSyncFinalRatingToGuide = false;
    updateRatingSuggestion();
}

function rememberFocusBeforeModal() {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function restoreFocusAfterModal() {
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function' && document.contains(lastFocusedElement)) {
        lastFocusedElement.focus();
    }
    lastFocusedElement = null;
}

function focusFirstModalControl(modalElement) {
    const firstControl = modalElement?.querySelector('input:not([type="hidden"]), select, textarea, button');
    if (firstControl && typeof firstControl.focus === 'function') {
        firstControl.focus();
    }
}

function getRatingMeta(grade) {
    const normalizedGrade = normalizeRatingGrade(grade);
    const rating = RATING_GUIDE_CONTENT[normalizedGrade];

    return {
        grade: normalizedGrade,
        label: rating.label,
        className: rating.className
    };
}

function renderRatingBadge(grade, compact = false) {
    const ratingMeta = getRatingMeta(grade);
    const label = compact
        ? `${ratingMeta.grade}`
        : `${ratingMeta.grade} - ${ratingMeta.label}`;

    return `<span class="rating-badge ${ratingMeta.className}">${label}</span>`;
}

function getCurrentFormRatingCriteria() {
    return normalizeRatingCriteria({
        rating2Min: document.getElementById('rating2Min')?.value,
        rating3Min: document.getElementById('rating3Min')?.value,
        rating4Min: document.getElementById('rating4Min')?.value,
        rating5Min: document.getElementById('rating5Min')?.value
    });
}

function getRatingCriteriaGuide(criteria) {
    const normalizedCriteria = normalizeRatingCriteria(criteria);

    return [
        `1: Below ${normalizedCriteria.rating2Min}% of target`,
        `2: ${normalizedCriteria.rating2Min}% to ${normalizedCriteria.rating3Min - 1}% of target`,
        `3: ${normalizedCriteria.rating3Min}% to ${normalizedCriteria.rating4Min - 1}% of target`,
        `4: ${normalizedCriteria.rating4Min}% to ${normalizedCriteria.rating5Min - 1}% of target`,
        `5: ${normalizedCriteria.rating5Min}% of target or more`
    ];
}

function renderRatingGuidePreview(criteria) {
    const guidePreviewElement = document.getElementById('ratingGuidePreview');
    if (!guidePreviewElement) {
        return;
    }

    guidePreviewElement.innerHTML = getRatingCriteriaGuide(criteria).map((line, index) => `
        <span class="rating-guide-item ${index === 2 ? 'rating-guide-item-focus' : ''}">${escapeHtml(line)}</span>
    `).join('');
}

function getRatingComparisonState(actual, target, ratingCriteria, selectedGrade) {
    const recommendedRating = getCalculatedRatingFromPerformance(actual, target, ratingCriteria);
    const selectedRating = getRatingMeta(selectedGrade);
    const hasRecommendation = recommendedRating.hasData;
    const hasMismatch = hasRecommendation && selectedRating.grade !== recommendedRating.grade;
    const levelDifference = hasRecommendation ? selectedRating.grade - recommendedRating.grade : 0;

    return {
        selectedRating,
        recommendedRating,
        hasRecommendation,
        hasMismatch,
        levelDifference
    };
}

function renderRatingScale(selectedGrade, recommendedGrade = null) {
    return Object.keys(RATING_GUIDE_CONTENT).map(gradeKey => {
        const grade = Number(gradeKey);
        const ratingMeta = getRatingMeta(grade);
        const isSelected = grade === Number(selectedGrade);
        const isRecommended = grade === Number(recommendedGrade);
        const stateClass = isSelected && isRecommended
            ? 'is-both'
            : isSelected
                ? 'is-selected'
                : isRecommended
                    ? 'is-recommended'
                    : '';
        const stateLabel = isSelected && isRecommended
            ? 'Guide + Final'
            : isSelected
                ? 'Final'
                : isRecommended
                    ? 'Guide'
                    : '&nbsp;';

        return `
            <div class="rating-scale-item ${ratingMeta.className} ${stateClass}">
                <span class="rating-scale-grade">${ratingMeta.grade}</span>
                <span class="rating-scale-label">${escapeHtml(ratingMeta.label)}</span>
                <span class="rating-scale-flag">${stateLabel}</span>
            </div>
        `;
    }).join('');
}

function renderRatingMatchup(comparisonState) {
    if (!comparisonState.hasRecommendation) {
        return '<p class="rating-matchup-helper">Enter Target and Actual values to compare the final rating with the guide.</p>';
    }

    const differenceLabel = comparisonState.levelDifference === 0
        ? 'No difference'
        : `${comparisonState.levelDifference > 0 ? '+' : ''}${comparisonState.levelDifference} level${Math.abs(comparisonState.levelDifference) === 1 ? '' : 's'}`;

    return `
        <div class="rating-matchup-card">
            <span class="rating-matchup-label">Recommended Rating</span>
            <div class="rating-matchup-value">
                ${renderRatingBadge(comparisonState.recommendedRating.grade)}
                <span class="rating-matchup-note">${Math.round(comparisonState.recommendedRating.achievement)}% of target</span>
            </div>
        </div>
        <div class="rating-matchup-card">
            <span class="rating-matchup-label">Selected Final Rating</span>
            <div class="rating-matchup-value">
                ${renderRatingBadge(comparisonState.selectedRating.grade)}
                <span class="rating-matchup-note">${escapeHtml(comparisonState.selectedRating.label)}</span>
            </div>
        </div>
        <div class="rating-matchup-card">
            <span class="rating-matchup-label">Difference</span>
            <div class="rating-matchup-value">
                <span class="rating-difference-value ${comparisonState.hasMismatch ? 'is-mismatch' : 'is-match'}">${differenceLabel}</span>
                <span class="rating-matchup-note">${comparisonState.hasMismatch ? 'Please document the business reason for the override.' : 'Selected rating follows the guide.'}</span>
            </div>
        </div>
    `;
}

function syncRatingMismatchUi(comparisonState) {
    const ratingGuideScale = document.getElementById('ratingGuideScale');
    const ratingMatchup = document.getElementById('ratingMatchup');
    const mismatchBox = document.getElementById('ratingMismatchBox');
    const justificationGroup = document.getElementById('ratingJustificationGroup');
    const justificationInput = document.getElementById('kpiRatingJustification');
    const justificationLabel = document.getElementById('justificationLabel');
    const justificationHelperText = document.getElementById('justificationHelperText');

    if (ratingGuideScale) {
        ratingGuideScale.innerHTML = renderRatingScale(
            comparisonState.selectedRating.grade,
            comparisonState.hasRecommendation ? comparisonState.recommendedRating.grade : null
        );
    }

    if (ratingMatchup) {
        ratingMatchup.innerHTML = renderRatingMatchup(comparisonState);
    }

    if (mismatchBox) {
        mismatchBox.classList.toggle('is-hidden', !comparisonState.hasMismatch);
    }

    // Update justification field label and helper text based on mismatch state
    if (justificationLabel) {
        if (comparisonState.hasMismatch) {
            justificationLabel.textContent = 'Mismatch Justification *';
        } else {
            justificationLabel.textContent = 'Rating Justification & Comments';
        }
    }

    if (justificationHelperText) {
        if (comparisonState.hasMismatch) {
            justificationHelperText.textContent = 'Describe why the final rating should differ from the recommended result, including impact, constraints, or verified achievements.';
        } else {
            justificationHelperText.textContent = 'Add comments or explain the rating decision, including business context and supporting evidence.';
        }
    }

    // Justification group is always visible, but input is required only when there's a mismatch
    if (justificationInput) {
        justificationInput.required = comparisonState.hasMismatch;
    }
}

function getCalculatedRatingFromPerformance(actual, target, ratingCriteria = getDefaultRatingCriteria()) {
    const actualValue = Number(actual);
    const targetValue = Number(target);

    if (!Number.isFinite(actualValue) || !Number.isFinite(targetValue) || targetValue <= 0) {
        return {
            ...getRatingMeta(3),
            achievement: 0,
            hasData: false
        };
    }

    const normalizedCriteria = normalizeRatingCriteria(ratingCriteria);
    const achievement = (actualValue / targetValue) * 100;
    let grade = 1;

    if (achievement >= normalizedCriteria.rating5Min) {
        grade = 5;
    } else if (achievement >= normalizedCriteria.rating4Min) {
        grade = 4;
    } else if (achievement >= normalizedCriteria.rating3Min) {
        grade = 3;
    } else if (achievement >= normalizedCriteria.rating2Min) {
        grade = 2;
    }

    return {
        ...getRatingMeta(grade),
        achievement,
        hasData: true
    };
}

function updateRatingSuggestion() {
    const suggestionElement = document.getElementById('ratingSuggestion');
    const ratingInput = document.getElementById('kpiRatingGrade');
    const targetInput = document.getElementById('kpiTarget');
    const actualInput = document.getElementById('kpiActual');

    if (!suggestionElement || !ratingInput || !targetInput || !actualInput) {
        return;
    }

    const ratingCriteria = getCurrentFormRatingCriteria();
    renderRatingGuidePreview(ratingCriteria);
    updateEvaluationContextPanel();

    if (!isValidRatingCriteria(ratingCriteria)) {
        suggestionElement.textContent = 'Performance summary: keep the rating thresholds in ascending order before reviewing the recommendation.';
        syncRatingMismatchUi({
            selectedRating: getRatingMeta(ratingInput.value),
            recommendedRating: getRatingMeta(ratingInput.value),
            hasRecommendation: false,
            hasMismatch: false
        });
        return;
    }

    const recommendedRating = getCalculatedRatingFromPerformance(actualInput.value, targetInput.value, ratingCriteria);
    if (shouldSyncFinalRatingToGuide && recommendedRating.hasData) {
        ratingInput.value = String(recommendedRating.grade);
    }

    const comparisonState = getRatingComparisonState(actualInput.value, targetInput.value, ratingCriteria, ratingInput.value);
    const suggestedRating = comparisonState.recommendedRating;
    const selectedRating = comparisonState.selectedRating;
    syncRatingMismatchUi(comparisonState);

    if (!suggestedRating.hasData) {
        suggestionElement.textContent = 'Performance summary: enter Target and Actual values to calculate achievement and recommended rating.';
        return;
    }

    const matchText = !comparisonState.hasMismatch
        ? 'Selected rating matches the guide.'
        : `Guide suggests ${suggestedRating.grade}, current selection is ${selectedRating.grade}. Add clear business context below.`;

    suggestionElement.textContent = `Performance summary: ${Math.round(suggestedRating.achievement)}% of target, status ${getStatus(suggestedRating.achievement)}. Recommended rating ${suggestedRating.grade} - ${suggestedRating.label}. ${matchText}`;
}

// Evaluation workflow context keeps the left-side panel useful while the evaluator works through the rating decision.
function updateEvaluationContextPanel() {
    const contextElement = document.getElementById('evaluationKpiContext');
    if (!contextElement) {
        return;
    }

    const name = document.getElementById('kpiName')?.value.trim() || 'New KPI';
    const owner = document.getElementById('kpiOwner')?.value.trim() || '-';
    const team = document.getElementById('kpiTeam')?.value.trim() || '-';
    const startDate = document.getElementById('kpiStartDate')?.value || '';
    const endDate = document.getElementById('kpiEndDate')?.value || '';
    const baseline = normalizeOptionalNumberValue(document.getElementById('kpiLastYearResult')?.value);
    const target = Number(document.getElementById('kpiTarget')?.value);
    const actual = Number(document.getElementById('kpiActual')?.value);
    const unit = document.getElementById('kpiUnit')?.value.trim() || '';
    const hasPerformanceData = Number.isFinite(target) && target > 0 && Number.isFinite(actual);
    const achievement = hasPerformanceData ? calculateProgress(actual, target) : null;
    const status = hasPerformanceData ? getStatus(achievement) : 'Pending';
    const statusMarkup = hasPerformanceData
        ? `<span class="evaluation-context-status badge badge-${status.toLowerCase().replace('-', '-')}">${escapeHtml(status)}</span>`
        : '<span class="evaluation-context-status evaluation-context-status-pending">Pending</span>';
    const smartCount = getSmartCompletionCount({
        specific: document.getElementById('smartSpecific')?.value,
        measurable: document.getElementById('smartMeasurable')?.value,
        achievable: document.getElementById('smartAchievable')?.value,
        relevant: document.getElementById('smartRelevant')?.value,
        timeBound: document.getElementById('smartTimeBound')?.value
    });

    contextElement.innerHTML = `
        <div class="evaluation-context-head">
            <span class="evaluation-context-kpi">${escapeHtml(name)}</span>
            ${statusMarkup}
        </div>
        <div class="evaluation-context-grid">
            <div class="evaluation-context-item">
                <span class="evaluation-context-label">Owner</span>
                <span class="evaluation-context-value">${escapeHtml(owner)}</span>
            </div>
            <div class="evaluation-context-item">
                <span class="evaluation-context-label">Team</span>
                <span class="evaluation-context-value">${escapeHtml(team)}</span>
            </div>
            <div class="evaluation-context-item">
                <span class="evaluation-context-label">Review period</span>
                <span class="evaluation-context-value">${startDate && endDate ? `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}` : '-'}</span>
            </div>
            <div class="evaluation-context-item">
                <span class="evaluation-context-label">SMART completion</span>
                <span class="evaluation-context-value">${smartCount}/5</span>
            </div>
            <div class="evaluation-context-item">
                <span class="evaluation-context-label">Baseline</span>
                <span class="evaluation-context-value">${baseline ?? '-'}${unit ? ` ${escapeHtml(unit)}` : ''}</span>
            </div>
            <div class="evaluation-context-item">
                <span class="evaluation-context-label">Target</span>
                <span class="evaluation-context-value">${Number.isFinite(target) ? target : '-'}${unit ? ` ${escapeHtml(unit)}` : ''}</span>
            </div>
            <div class="evaluation-context-item">
                <span class="evaluation-context-label">Actual</span>
                <span class="evaluation-context-value">${Number.isFinite(actual) ? actual : '-'}${unit ? ` ${escapeHtml(unit)}` : ''}</span>
            </div>
            <div class="evaluation-context-item">
                <span class="evaluation-context-label">Achievement</span>
                <span class="evaluation-context-value">${hasPerformanceData ? `${Math.round(achievement)}%` : '-'}</span>
            </div>
        </div>
    `;
}

function getCommentPreview(comment, maxLength = 82) {
    const normalizedText = String(comment || '').replace(/\s+/g, ' ').trim();
    if (!normalizedText) {
        return '<span class="table-preview-empty">-</span>';
    }

    const preview = normalizedText.length > maxLength
        ? `${normalizedText.slice(0, maxLength - 1).trimEnd()}...`
        : normalizedText;

    return escapeHtml(preview);
}

// Check SMART criteria completeness
function checkSmartCriteria() {
    const smartSpecific = document.getElementById('smartSpecific').value.trim();
    const smartMeasurable = document.getElementById('smartMeasurable').value.trim();
    const smartAchievable = document.getElementById('smartAchievable').value.trim();
    const smartRelevant = document.getElementById('smartRelevant').value.trim();
    const smartTimeBound = document.getElementById('smartTimeBound').value.trim();
    
    const isComplete = smartSpecific && smartMeasurable && smartAchievable && smartRelevant && smartTimeBound;
    
    const warningElement = document.getElementById('smartWarning');
    if (!isComplete) {
        warningElement.style.display = 'block';
    } else {
        warningElement.style.display = 'none';
    }

    updateEvaluationContextPanel();
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Escape HTML special characters
function escapeHtml(text) {
    const safeText = String(text ?? '');
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return safeText.replace(/[&<>"']/g, m => map[m]);
}

// Get SMART criteria details for display
function getSmartDetails(smart) {
    if (!smart) return '<span style="color: #9ca3af;">No SMART</span>';
    
    const items = [];
    if (smart.specific && smart.specific.trim()) items.push('✓ S');
    if (smart.measurable && smart.measurable.trim()) items.push('✓ M');
    if (smart.achievable && smart.achievable.trim()) items.push('✓ A');
    if (smart.relevant && smart.relevant.trim()) items.push('✓ R');
    if (smart.timeBound && smart.timeBound.trim()) items.push('✓ T');
    
    if (items.length === 0) {
        return '<span style="color: #ef4444; font-size: 0.8rem;">0/5</span>';
    }
    
    return `<span style="font-size: 0.8rem; color: #10b981;">${items.length}/5</span>`;
}

// Get SMART criteria tooltip content
function getSmartTooltip(smart) {
    if (!smart) return 'No SMART criteria defined';
    
    let tooltip = [];
    
    if (smart.specific && smart.specific.trim()) {
        tooltip.push(`📌 Specific:\n${smart.specific}`);
    }
    if (smart.measurable && smart.measurable.trim()) {
        tooltip.push(`📊 Measurable:\n${smart.measurable}`);
    }
    if (smart.achievable && smart.achievable.trim()) {
        tooltip.push(`✅ Achievable:\n${smart.achievable}`);
    }
    if (smart.relevant && smart.relevant.trim()) {
        tooltip.push(`🎯 Relevant:\n${smart.relevant}`);
    }
    if (smart.timeBound && smart.timeBound.trim()) {
        tooltip.push(`⏰ Time-bound:\n${smart.timeBound}`);
    }
    
    if (tooltip.length === 0) {
        return 'No SMART criteria defined';
    }
    
    return tooltip.join('\n\n');
}

// ==========================================
// SMART TOOLTIP FUNCTIONS
// ==========================================

// Attach hover listeners to SMART cells after the table is rendered
function attachSmartTooltipListeners() {
    const smartCells = document.querySelectorAll('.smart-criteria-cell');
    
    smartCells.forEach(cell => {
        cell.setAttribute('aria-describedby', 'smartTooltip');
        cell.addEventListener('mouseenter', showSmartTooltip);
        cell.addEventListener('mousemove', moveSmartTooltip);
        cell.addEventListener('mouseleave', hideSmartTooltip);
        cell.addEventListener('focus', showSmartTooltip);
        cell.addEventListener('blur', hideSmartTooltip);
    });
}

// Attach hover listeners to the SMART helper buttons in the form.
function attachSmartHelperTooltipListeners() {
    const helperButtons = document.querySelectorAll('.smart-info-trigger');

    helperButtons.forEach(button => {
        button.setAttribute('aria-describedby', 'smartTooltip');
        button.addEventListener('mouseenter', showSmartTooltip);
        button.addEventListener('mousemove', moveSmartTooltip);
        button.addEventListener('mouseleave', hideSmartTooltip);
        button.addEventListener('focus', showSmartTooltip);
        button.addEventListener('blur', hideSmartTooltip);
    });
}

// Show the floating SMART tooltip
function showSmartTooltip(event) {
    if (!smartTooltipElement) return;
    
    smartTooltipElement.innerHTML = buildSmartTooltipMarkup(event.currentTarget);
    smartTooltipElement.classList.add('active');
    smartTooltipElement.setAttribute('aria-hidden', 'false');
    positionSmartTooltip(event);
}

// Move the tooltip with the mouse
function moveSmartTooltip(event) {
    positionSmartTooltip(event);
}

// Hide the floating SMART tooltip
function hideSmartTooltip() {
    if (!smartTooltipElement) return;
    
    smartTooltipElement.classList.remove('active');
    smartTooltipElement.setAttribute('aria-hidden', 'true');
    smartTooltipElement.innerHTML = '';
}

// Keep the tooltip inside the visible browser area
function positionSmartTooltip(event) {
    if (!smartTooltipElement) return;
    
    const tooltipWidth = smartTooltipElement.offsetWidth;
    const tooltipHeight = smartTooltipElement.offsetHeight;
    const horizontalGap = 16;
    const verticalGap = 20;
    
    const target = event.currentTarget || event.target;
    const hasPointerPosition = Number.isFinite(event.clientX) && Number.isFinite(event.clientY) &&
        (event.clientX !== 0 || event.clientY !== 0);
    const targetRect = target && typeof target.getBoundingClientRect === 'function'
        ? target.getBoundingClientRect()
        : null;
    
    let left = hasPointerPosition
        ? event.clientX + horizontalGap
        : (targetRect ? targetRect.right + horizontalGap : 12);
    let top = hasPointerPosition
        ? event.clientY + verticalGap
        : (targetRect ? targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2) : 12);
    
    if (left + tooltipWidth > window.innerWidth - 12) {
        left = hasPointerPosition
            ? event.clientX - tooltipWidth - horizontalGap
            : window.innerWidth - tooltipWidth - 12;
    }
    
    if (top + tooltipHeight > window.innerHeight - 12) {
        top = hasPointerPosition
            ? event.clientY - tooltipHeight - verticalGap
            : window.innerHeight - tooltipHeight - 12;
    }
    
    left = Math.max(12, left);
    top = Math.max(12, top);
    
    smartTooltipElement.style.left = `${left}px`;
    smartTooltipElement.style.top = `${top}px`;
}

function buildSmartTooltipMarkup(trigger) {
    if (!trigger) {
        return '<div class="smart-tooltip-empty">No SMART guidance available.</div>';
    }

    const smartKey = trigger.dataset.smartKey;
    if (smartKey && SMART_GUIDE_CONTENT[smartKey]) {
        const definition = SMART_GUIDE_CONTENT[smartKey];
        return `
            <div class="smart-tooltip-card">
                <div class="smart-tooltip-overline">SMART guide</div>
                <div class="smart-tooltip-heading">
                    <span class="smart-tooltip-badge">${definition.badge}</span>
                    <div>
                        <span class="smart-tooltip-title">${definition.label}</span>
                        <p class="smart-tooltip-body">${definition.helper}</p>
                    </div>
                </div>
            </div>
        `;
    }

    return buildSmartCriteriaTooltipMarkup(trigger.dataset.smartTooltip || 'No SMART criteria defined');
}

function buildSmartCriteriaTooltipMarkup(text) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText || normalizedText === 'No SMART criteria defined') {
        return '<div class="smart-tooltip-empty">No SMART criteria defined.</div>';
    }

    const items = normalizedText.split(/\n\s*\n/).map(section => {
        const [rawLabel, ...bodyLines] = section.split('\n');
        if (!rawLabel) {
            return null;
        }

        const label = rawLabel.replace(':', '').trim();
        const definition = Object.values(SMART_GUIDE_CONTENT).find(item => item.label === label);

        return {
            badge: definition ? definition.badge : label.charAt(0).toUpperCase(),
            label,
            body: bodyLines.join(' ').trim() || 'No details provided.'
        };
    }).filter(Boolean);

    if (items.length === 0) {
        return `<div class="smart-tooltip-empty">${escapeHtml(normalizedText)}</div>`;
    }

    return `
        <div class="smart-tooltip-card">
            <div class="smart-tooltip-overline">SMART criteria</div>
            <div class="smart-tooltip-list">
                ${items.map(item => `
                    <div class="smart-tooltip-item">
                        <span class="smart-tooltip-badge">${escapeHtml(item.badge)}</span>
                        <div>
                            <span class="smart-tooltip-title">${escapeHtml(item.label)}</span>
                            <p class="smart-tooltip-body">${escapeHtml(item.body)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function handlePersistenceError(message, error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    showAppStatus(`${message} ${detail}`, 'error');
}

// ==========================================
// DRAG AND DROP FUNCTIONALITY
// ==========================================

// Clean UI renderers and SMART helpers override legacy text with ASCII-safe content.
function renderProgressOverview() {
    const container = document.getElementById('progressOverview');
    const toggleButton = document.getElementById('progressToggleBtn');
    const meta = document.getElementById('progressOverviewMeta');
    if (!container) {
        return;
    }

    updateProgressOverviewViewButtons();
    const kpis = getSortedProgressOverviewKpis();
    const visibleLimit = getProgressOverviewLimit();
    const shouldCollapse = !isProgressOverviewExpanded && kpis.length > visibleLimit;
    const visibleKpis = shouldCollapse ? kpis.slice(0, visibleLimit) : kpis;

    container.classList.toggle('is-list-view', progressOverviewView === 'list');

    if (kpis.length === 0) {
        const activeFilters = getActiveFilters();
        container.innerHTML = `
            <div class="empty-state empty-state-panel">
                <strong>No progress cards match these filters.</strong>
                <span>${activeFilters.length > 0 ? 'Adjust the active filters to bring KPI cards back.' : 'Create a KPI to start tracking progress.'}</span>
            </div>
        `;
        container.classList.remove('is-scrollable-collapsed', 'is-list-view');
        container.style.maxHeight = '';
        container.scrollTop = 0;
        if (toggleButton) {
            toggleButton.hidden = true;
        }
        if (meta) {
            meta.textContent = '0 cards';
        }
        return;
    }

    container.innerHTML = visibleKpis.map(kpi => {
        const progress = calculateProgress(kpi.actual, kpi.target);
        const status = getStatus(progress);
        const progressColor = getProgressColor(status);
        const statusClass = getProgressStatusClass(status);
        const category = getProgressCardCategory(kpi);
        const dueSoonClass = isProgressKpiUrgent(kpi, status) ? 'is-urgent' : '';

        return `
            <div class="progress-item progress-item-${statusClass}">
                <div class="progress-card-top">
                    <div class="progress-card-tags">
                        <span class="progress-status-badge progress-status-${statusClass}">${status}</span>
                        <span class="progress-category-chip">${escapeHtml(category)}</span>
                    </div>
                    <span class="progress-percent">${Math.round(progress)}%</span>
                </div>
                <div class="progress-card-main">
                    <span class="progress-title">${escapeHtml(kpi.name)}</span>
                    <span class="progress-owner-team">${escapeHtml(kpi.owner)} / ${escapeHtml(kpi.team)}</span>
                </div>
                <div class="progress-bar-wrap">
                    <div class="progress-bar">
                        <div class="progress-fill" style="transform: scaleX(${Math.min(progress, 100) / 100}); background: ${progressColor};"></div>
                    </div>
                    <div class="progress-details">
                        <span>Actual ${formatProgressMetricValue(kpi.actual)} ${escapeHtml(kpi.unit)}</span>
                        <span>Target ${formatProgressMetricValue(kpi.target)} ${escapeHtml(kpi.unit)}</span>
                    </div>
                </div>
                <div class="progress-card-meta">
                    <span class="progress-meta-chip ${dueSoonClass}">Due ${formatDisplayDate(kpi.endDate)}</span>
                    ${getProgressCardWeightMarkup(kpi)}
                </div>
            </div>
        `;
    }).join('');

    applyProgressOverviewScrollState(container, false);

    if (meta) {
        meta.textContent = shouldCollapse
            ? `Showing ${visibleKpis.length} of ${kpis.length} cards / ${getProgressSortLabel()} / ${progressOverviewView === 'list' ? 'List view' : 'Grid view'}`
            : `${kpis.length} cards / ${getProgressSortLabel()} / ${progressOverviewView === 'list' ? 'List view' : 'Grid view'}`;
    }

    if (toggleButton) {
        toggleButton.hidden = kpis.length <= visibleLimit;
        toggleButton.textContent = isProgressOverviewExpanded ? 'Show Less' : 'Show More';
    }
}

function applyProgressOverviewScrollState(container, shouldCollapseWithScroll) {
    container.classList.toggle('is-scrollable-collapsed', shouldCollapseWithScroll);

    if (!shouldCollapseWithScroll) {
        container.style.maxHeight = '';
        if (isProgressOverviewExpanded) {
            container.scrollTop = 0;
        }
        return;
    }

    container.scrollTop = 0;

    requestAnimationFrame(() => {
        const cards = [...container.querySelectorAll('.progress-item')];
        if (cards.length === 0) {
            container.style.maxHeight = '';
            return;
        }

        const rowTops = [...new Set(cards.map(card => card.offsetTop))].sort((a, b) => a - b);
        if (rowTops.length <= 2) {
            container.style.maxHeight = '';
            return;
        }

        const secondRowTop = rowTops[1];
        const secondRowCards = cards.filter(card => card.offsetTop === secondRowTop);
        const secondRowBottom = Math.max(...secondRowCards.map(card => card.offsetTop + card.offsetHeight));
        container.style.maxHeight = `${secondRowBottom + 4}px`;
    });
}

function setKpiTableDensity(density) {
    kpiTableDensity = density === 'compact' ? 'compact' : 'comfortable';
    updateKpiTableDensityButtons();
    renderKpiTable();
}

function updateKpiTableDensityButtons() {
    document.querySelectorAll('.density-btn').forEach(button => {
        button.classList.toggle('is-active', button.dataset.density === kpiTableDensity);
    });
}

function handleDocumentClick(event) {
    const clearFilterButton = event.target.closest('[data-clear-filter]');
    if (clearFilterButton) {
        clearFilterByKey(clearFilterButton.dataset.clearFilter);
        return;
    }

    const clearAllButton = event.target.closest('[data-clear-all-filters]');
    if (clearAllButton) {
        clearFilters();
        document.getElementById('searchInput')?.focus();
        return;
    }

    if (!event.target.closest('.table-row-menu')) {
        if (activeKpiRowMenuId !== null) {
            activeKpiRowMenuId = null;
            renderKpiTable();
        }
    }
}

function handleRowMenuKeydown(event) {
    const menuToggle = event.target.closest('.row-menu-toggle');
    const menuAction = event.target.closest('.row-menu-action');

    if (menuToggle && ['Enter', ' ', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        toggleKpiRowMenu(Number(menuToggle.dataset.kpiId), true);
        return;
    }

    if (!menuAction) return;

    const menu = menuAction.closest('.table-row-menu');
    const actions = [...menu.querySelectorAll('.row-menu-action')];
    const currentIndex = actions.indexOf(menuAction);

    if (event.key === 'Escape') {
        event.preventDefault();
        const kpiId = Number(menuAction.dataset.kpiId);
        activeKpiRowMenuId = null;
        renderKpiTable();
        focusRowMenuToggle(kpiId);
        return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = (currentIndex + direction + actions.length) % actions.length;
        actions[nextIndex].focus();
    }
}

function handleTableBodyClick(event) {
    const clearFilterButton = event.target.closest('[data-clear-filter]');
    if (clearFilterButton) {
        event.stopPropagation();
        clearFilterByKey(clearFilterButton.dataset.clearFilter);
        return;
    }

    const clearAllButton = event.target.closest('[data-clear-all-filters]');
    if (clearAllButton) {
        event.stopPropagation();
        clearFilters();
        return;
    }

    const detailToggle = event.target.closest('.row-detail-toggle');
    if (detailToggle) {
        toggleKpiRowDetails(Number(detailToggle.dataset.kpiId));
        return;
    }

    const menuToggle = event.target.closest('.row-menu-toggle');
    if (menuToggle) {
        event.stopPropagation();
        toggleKpiRowMenu(Number(menuToggle.dataset.kpiId));
        return;
    }

    const menuAction = event.target.closest('.row-menu-action');
    if (menuAction) {
        event.stopPropagation();
        const kpiId = Number(menuAction.dataset.kpiId);
        const action = menuAction.dataset.action;
        activeKpiRowMenuId = null;

        if (action === 'view') {
            viewKpiDetails(kpiId);
        } else if (action === 'edit') {
            editKpi(kpiId);
        } else if (action === 'delete') {
            openDeleteModal(kpiId);
        }

        renderKpiTable();
    }
}

function toggleKpiRowDetails(kpiId) {
    if (expandedKpiRowIds.has(kpiId)) {
        expandedKpiRowIds.delete(kpiId);
    } else {
        expandedKpiRowIds.add(kpiId);
    }

    activeKpiRowMenuId = null;
    renderKpiTable();
}

function toggleKpiRowMenu(kpiId, focusFirstAction = false) {
    activeKpiRowMenuId = activeKpiRowMenuId === kpiId ? null : kpiId;
    renderKpiTable();

    if (focusFirstAction && activeKpiRowMenuId === kpiId) {
        const firstAction = document.querySelector(`.table-row-menu.is-open .row-menu-action[data-kpi-id="${kpiId}"]`);
        firstAction?.focus();
    }
}

function focusRowMenuToggle(kpiId) {
    document.querySelector(`.row-menu-toggle[data-kpi-id="${kpiId}"]`)?.focus();
}

function handleTableSortClick(event) {
    const sortButton = event.target.closest('.table-sort-btn');
    if (!sortButton) {
        return;
    }

    const sortKey = sortButton.dataset.sortKey;
    if (!sortKey) {
        return;
    }

    if (kpiTableSort.key === sortKey) {
        kpiTableSort.direction = kpiTableSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        kpiTableSort = {
            key: sortKey,
            direction: ['progress', 'status', 'rating'].includes(sortKey) ? 'desc' : 'asc'
        };
    }

    renderKpiTableHeader();
    renderKpiTable();
}

// KPI table enhancements keep the default table focused while secondary information lives in expandable details.
function renderKpiTableHeader() {
    const tableHeaderRow = document.querySelector('.kpi-table thead tr');
    if (!tableHeaderRow) {
        return;
    }

    tableHeaderRow.innerHTML = `
        <th class="selection-column">
            <input type="checkbox" id="selectAllCheckbox" aria-label="Select all visible KPIs">
        </th>
        <th>${renderKpiTableSortButton('KPI Name', 'name')}</th>
        <th>${renderKpiTableSortButton('Owner', 'owner')}</th>
        <th>${renderKpiTableSortButton('Team', 'team')}</th>
        <th>${renderKpiTableSortButton('Target', 'target')}</th>
        <th>${renderKpiTableSortButton('Actual', 'actual')}</th>
        <th>${renderKpiTableSortButton('Progress', 'progress')}</th>
        <th>${renderKpiTableSortButton('Status', 'status')}</th>
        <th>${renderKpiTableSortButton('Rating', 'rating')}</th>
        <th>${renderKpiTableSortButton('SMART', 'smart')}</th>
        <th class="actions-column">Actions</th>
    `;
}

function renderKpiTableSortButton(label, key) {
    const isActive = kpiTableSort.key === key;
    const directionLabel = isActive ? (kpiTableSort.direction === 'asc' ? 'Ascending' : 'Descending') : 'Not sorted';
    const indicator = isActive ? (kpiTableSort.direction === 'asc' ? '^' : 'v') : '<>';

    return `
        <button type="button" class="table-sort-btn ${isActive ? 'is-active' : ''}" data-sort-key="${key}" aria-label="Sort by ${escapeHtml(label)}. ${directionLabel}.">
            <span>${escapeHtml(label)}</span>
            <span class="table-sort-indicator" aria-hidden="true">${indicator}</span>
        </button>
    `;
}

function getSortedTableKpis() {
    const kpis = [...getFilteredKpis()];
    const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

    const compareText = (left, right, valueLeft, valueRight) => collator.compare(String(valueLeft ?? ''), String(valueRight ?? ''));
    const compareNumber = (leftValue, rightValue) => Number(leftValue || 0) - Number(rightValue || 0);
    const compareStatus = (left, right) => getProgressStatusPriority(left) - getProgressStatusPriority(right);
    const compareProgress = (left, right) => calculateProgress(left.actual, left.target) - calculateProgress(right.actual, right.target);
    const compareSmart = (left, right) => getSmartCompletionCount(left.smart) - getSmartCompletionCount(right.smart);

    kpis.sort((left, right) => {
        let sortResult = 0;

        switch (kpiTableSort.key) {
            case 'owner':
                sortResult = compareText(left, right, left.owner, right.owner);
                break;
            case 'team':
                sortResult = compareText(left, right, left.team, right.team);
                break;
            case 'target':
                sortResult = compareNumber(left.target, right.target);
                break;
            case 'actual':
                sortResult = compareNumber(left.actual, right.actual);
                break;
            case 'progress':
                sortResult = compareProgress(left, right);
                break;
            case 'status':
                sortResult = compareStatus(left, right);
                break;
            case 'rating':
                sortResult = compareNumber(left.ratingGrade, right.ratingGrade);
                break;
            case 'smart':
                sortResult = compareSmart(left, right);
                break;
            case 'name':
            default:
                sortResult = compareText(left, right, left.name, right.name);
                break;
        }

        if (sortResult === 0) {
            sortResult = compareText(left, right, left.name, right.name);
        }

        return kpiTableSort.direction === 'desc' ? sortResult * -1 : sortResult;
    });

    return kpis;
}

function getSmartCompletionCount(smart) {
    if (!smart) {
        return 0;
    }

    return [
        smart.specific,
        smart.measurable,
        smart.achievable,
        smart.relevant,
        smart.timeBound
    ].filter(value => value && value.trim()).length;
}

function renderCompactSmartBadge(smart) {
    const completedCount = getSmartCompletionCount(smart);
    const isComplete = completedCount === 5;
    const className = completedCount === 0 ? 'is-empty' : isComplete ? 'is-complete' : 'is-partial';

    return `
        <span class="smart-summary-badge ${className}">
            <span class="smart-summary-label">SMART</span>
            <span class="smart-summary-value">${completedCount}/5</span>
        </span>
    `;
}

function renderKpiRowIndicators(kpi, hasMismatch) {
    const indicators = [];

    if (kpi.midYearComment) {
        indicators.push('<span class="kpi-inline-chip">Mid-year note</span>');
    }
    if (kpi.yearEndComment) {
        indicators.push('<span class="kpi-inline-chip">Year-end note</span>');
    }
    if (hasMismatch) {
        indicators.push('<span class="kpi-inline-chip is-warning">Mismatch</span>');
    }

    return indicators.join('');
}

function renderCompactRatingCell(kpi, ratingComparison) {
    const ratingMeta = getRatingMeta(kpi.ratingGrade);
    return `
        <div class="rating-compact-cell">
            <span class="rating-number-pill ${ratingMeta.className}">${ratingMeta.grade}</span>
            <div class="rating-compact-copy">
                <span class="rating-compact-label">${escapeHtml(ratingMeta.label)}</span>
                ${ratingComparison.hasMismatch ? '<span class="rating-compact-mismatch">Guide mismatch</span>' : ''}
            </div>
        </div>
    `;
}

function renderFilterRecoveryActions() {
    const filters = getActiveFilters();
    if (filters.length === 0) {
        return '<button type="button" class="btn btn-secondary" id="emptyAddKpiBtn" onclick="openAddModal()">Add KPI</button>';
    }

    return `
        <div class="empty-filter-actions">
            ${filters.map(filter => `
                <button type="button" class="btn btn-secondary btn-sm" data-clear-filter="${filter.key}">
                    Clear ${escapeHtml(filter.label)}
                </button>
            `).join('')}
            <button type="button" class="btn btn-primary btn-sm" data-clear-all-filters="true">Show all KPIs</button>
        </div>
    `;
}

function renderEmptyKpiTableState() {
    const totalCount = getKpiData().length;
    const filters = getActiveFilters();
    const filterCopy = filters.length > 0
        ? `No records match ${filters.map(filter => `${filter.label} "${filter.value}"`).join(', ')}.`
        : totalCount === 0
            ? 'No KPI records exist yet.'
            : 'No KPI records match the current view.';
    const helperCopy = filters.length > 0
        ? 'Clear one filter or show the full list to recover the previous results.'
        : 'Create a KPI to start tracking team performance.';

    return `
        <tr class="empty-row">
            <td colspan="11" class="empty-message">
                <div class="empty-state-panel">
                    <strong>${escapeHtml(filterCopy)}</strong>
                    <span>${escapeHtml(helperCopy)}</span>
                    ${renderFilterRecoveryActions()}
                </div>
            </td>
        </tr>
    `;
}

function renderKpiRowDetails(kpi, ratingComparison) {
    const smartItems = [
        ['Specific', kpi.smart?.specific],
        ['Measurable', kpi.smart?.measurable],
        ['Achievable', kpi.smart?.achievable],
        ['Relevant', kpi.smart?.relevant],
        ['Time-bound', kpi.smart?.timeBound]
    ];

    const commentCards = `
        <div class="row-detail-card">
            <span class="row-detail-title">Mid-Year Comment</span>
            <p class="detail-comment-block">${escapeHtml(kpi.midYearComment || 'No mid-year comment yet.')}</p>
        </div>
        <div class="row-detail-card">
            <span class="row-detail-title">Year-End Comment</span>
            <p class="detail-comment-block">${escapeHtml(kpi.yearEndComment || 'No year-end comment yet.')}</p>
        </div>
    `;

    const smartCard = `
        <div class="row-detail-card">
            <span class="row-detail-title">SMART Breakdown</span>
            <div class="row-detail-smart-grid">
                ${smartItems.map(([label, value]) => `
                    <div class="row-detail-smart-item">
                        <span class="row-detail-smart-label">${escapeHtml(label)}</span>
                        <span class="row-detail-smart-value">${escapeHtml(value || 'Not provided')}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const mismatchCard = `
        <div class="row-detail-card">
            <span class="row-detail-title">Rating Guide And Final Rating</span>
            <div class="row-detail-rating-grid">
                <div class="row-detail-rating-item">
                    <span class="row-detail-meta-label">Recommended</span>
                    ${ratingComparison.hasRecommendation ? renderRatingBadge(ratingComparison.recommendedRating.grade) : '<span class="detail-rating-line">No calculated guide yet</span>'}
                </div>
                <div class="row-detail-rating-item">
                    <span class="row-detail-meta-label">Final rating</span>
                    ${renderRatingBadge(kpi.ratingGrade)}
                </div>
                <div class="row-detail-rating-item row-detail-rating-status ${ratingComparison.hasMismatch ? 'is-mismatch' : 'is-match'}">
                    ${ratingComparison.hasMismatch
                        ? 'Final rating does not match the rating guide.'
                        : 'Final rating matches the rating guide.'}
                </div>
            </div>
            <p class="detail-comment-block row-detail-justification">${escapeHtml(
                ratingComparison.hasMismatch
                    ? (kpi.ratingJustification || 'No justification provided.')
                    : (kpi.ratingJustification || 'No extra justification needed.')
            )}</p>
        </div>
    `;

    const metadataCard = `
        <div class="row-detail-card">
            <span class="row-detail-title">Metadata</span>
            <div class="row-detail-meta-grid">
                <div class="row-detail-meta-item">
                    <span class="row-detail-meta-label">Date range</span>
                    <span class="row-detail-meta-value">${formatDisplayDate(kpi.startDate)} - ${formatDisplayDate(kpi.endDate)}</span>
                </div>
                <div class="row-detail-meta-item">
                    <span class="row-detail-meta-label">Last year result</span>
                    <span class="row-detail-meta-value">${kpi.lastYearResult ?? '-'} ${escapeHtml(kpi.unit)}</span>
                </div>
                <div class="row-detail-meta-item">
                    <span class="row-detail-meta-label">Created</span>
                    <span class="row-detail-meta-value">${formatDisplayDateTime(kpi.createdAt)}</span>
                </div>
                <div class="row-detail-meta-item">
                    <span class="row-detail-meta-label">Updated</span>
                    <span class="row-detail-meta-value">${formatDisplayDateTime(kpi.updatedAt)}</span>
                </div>
            </div>
        </div>
    `;

    return `
        <div class="kpi-row-detail-panel">
            <div class="row-detail-section row-detail-section-comments">
                ${commentCards}
            </div>
            <div class="row-detail-section">
                ${smartCard}
                ${mismatchCard}
            </div>
            <div class="row-detail-section row-detail-section-meta">
                ${metadataCard}
            </div>
        </div>
    `;
}

function renderKpiTable() {
    const kpis = getSortedTableKpis();
    const tbody = document.getElementById('kpiTableBody');
    const tableResponsive = document.querySelector('.table-responsive');

    if (!tbody) {
        return;
    }

    updateKpiTableDensityButtons();
    renderKpiTableHeader();

    if (tableResponsive) {
        tableResponsive.classList.toggle('is-compact-density', kpiTableDensity === 'compact');
    }

    if (kpis.length === 0) {
        tbody.innerHTML = renderEmptyKpiTableState();
        updateSelectionUi(kpis);
        return;
    }

    tbody.innerHTML = kpis.map(kpi => {
        const progress = calculateProgress(kpi.actual, kpi.target);
        const status = getStatus(progress);
        const ratingComparison = getRatingComparisonState(kpi.actual, kpi.target, kpi.ratingCriteria, kpi.ratingGrade);
        const isSelected = selectedKpiIds.has(kpi.id);
        const isExpanded = expandedKpiRowIds.has(kpi.id);
        const isMenuOpen = activeKpiRowMenuId === kpi.id;

        return `
            <tr class="draggable-row ${isSelected ? 'selected-row' : ''}" draggable="true" data-kpi-id="${kpi.id}">
                <td class="selection-cell">
                    <input
                        type="checkbox"
                        class="row-select-checkbox"
                        data-kpi-id="${kpi.id}"
                        aria-label="Select ${escapeHtml(kpi.name)}"
                        ${isSelected ? 'checked' : ''}
                    >
                </td>
                <td>
                    <div class="kpi-name-cell">
                        <div class="kpi-name-row">
                            <strong>${escapeHtml(kpi.name)}</strong>
                        </div>
                        <div class="kpi-submeta-row">
                            ${renderKpiRowIndicators(kpi, ratingComparison.hasMismatch) || '<span class="kpi-subtext">Open details for comments, SMART, and metadata</span>'}
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(kpi.owner)}</td>
                <td>${escapeHtml(kpi.team)}</td>
                <td><div class="metric-stack"><strong>${kpi.target}</strong><span>${escapeHtml(kpi.unit)}</span></div></td>
                <td><div class="metric-stack"><strong>${kpi.actual}</strong><span>${escapeHtml(kpi.unit)}</span></div></td>
                <td>
                    <div class="table-progress">
                        <div class="table-progress-track">
                            <div class="table-progress-fill" style="transform: scaleX(${Math.min(progress, 100) / 100}); background: ${getProgressColor(status)};"></div>
                        </div>
                        <span>${Math.round(progress)}%</span>
                    </div>
                </td>
                <td data-label="Status"><span class="badge badge-${status.toLowerCase().replace('-', '-')}">${status}</span></td>
                <td data-label="Rating">
                    ${renderCompactRatingCell(kpi, ratingComparison)}
                </td>
                <td data-label="SMART">
                    <div
                        class="smart-summary-cell smart-criteria-cell"
                        data-smart-tooltip="${escapeHtml(getSmartTooltip(kpi.smart))}"
                        tabindex="0"
                        aria-label="SMART criteria ${getSmartCompletionCount(kpi.smart)} out of 5"
                    >
                        ${renderCompactSmartBadge(kpi.smart)}
                    </div>
                </td>
                <td data-label="Actions">
                    <div class="table-row-actions">
                        <button
                            type="button"
                            class="btn btn-sm btn-secondary row-detail-toggle"
                            data-kpi-id="${kpi.id}"
                            aria-expanded="${isExpanded ? 'true' : 'false'}"
                        >
                            ${isExpanded ? 'Hide' : 'Details'}
                        </button>
                        <div class="table-row-menu ${isMenuOpen ? 'is-open' : ''}">
                            <button
                                type="button"
                                class="row-menu-toggle"
                                data-kpi-id="${kpi.id}"
                                aria-label="More actions for ${escapeHtml(kpi.name)}"
                                aria-haspopup="menu"
                                aria-expanded="${isMenuOpen ? 'true' : 'false'}"
                                aria-controls="rowMenu${kpi.id}"
                            >...</button>
                            <div class="row-menu-list" id="rowMenu${kpi.id}" role="menu" aria-label="Actions for ${escapeHtml(kpi.name)}">
                                <button type="button" class="row-menu-action" data-kpi-id="${kpi.id}" data-action="view" role="menuitem">View Full</button>
                                <button type="button" class="row-menu-action" data-kpi-id="${kpi.id}" data-action="edit" role="menuitem">Edit</button>
                                <button type="button" class="row-menu-action is-danger" data-kpi-id="${kpi.id}" data-action="delete" role="menuitem">Delete</button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
            <tr class="kpi-detail-row ${isExpanded ? 'is-open' : ''}">
                <td colspan="11">
                    ${renderKpiRowDetails(kpi, ratingComparison)}
                </td>
            </tr>
        `;
    }).join('');

    attachSmartTooltipListeners();
    updateSelectionUi(kpis);
}

function viewKpiDetails(id) {
    const kpi = getKpiById(id);
    if (!kpi) return;

    rememberFocusBeforeModal();
    editingKpiId = id;
    const progress = calculateProgress(kpi.actual, kpi.target);
    const status = getStatus(progress);
    const ratingMeta = getRatingMeta(kpi.ratingGrade);
    const ratingComparison = getRatingComparisonState(kpi.actual, kpi.target, kpi.ratingCriteria, kpi.ratingGrade);
    const ratingCriteriaGuide = getRatingCriteriaGuide(kpi.ratingCriteria);
    const smartStatus = isSmartComplete(kpi.smart) ? 'Complete' : 'Incomplete';

    document.getElementById('detailModalTitle').textContent = kpi.name;

    const smartDetails = kpi.smart ? `
        <div class="detail-smart-section">
            <h4>SMART Criteria (${smartStatus})</h4>
            <div class="detail-smart-grid">
                ${kpi.smart.specific ? `<div class="smart-item"><strong>Specific:</strong> ${escapeHtml(kpi.smart.specific)}</div>` : ''}
                ${kpi.smart.measurable ? `<div class="smart-item"><strong>Measurable:</strong> ${escapeHtml(kpi.smart.measurable)}</div>` : ''}
                ${kpi.smart.achievable ? `<div class="smart-item"><strong>Achievable:</strong> ${escapeHtml(kpi.smart.achievable)}</div>` : ''}
                ${kpi.smart.relevant ? `<div class="smart-item"><strong>Relevant:</strong> ${escapeHtml(kpi.smart.relevant)}</div>` : ''}
                ${kpi.smart.timeBound ? `<div class="smart-item"><strong>Time-bound:</strong> ${escapeHtml(kpi.smart.timeBound)}</div>` : ''}
            </div>
        </div>
    ` : '';

    const evaluationSummary = `
        <div class="detail-evaluation-section">
            <h4>Evaluation Summary</h4>
            <div class="detail-evaluation-grid">
                <div class="evaluation-card evaluation-card-rating">
                    <span class="evaluation-card-label">Final Rating</span>
                    <div class="evaluation-rating-stack">
                        ${renderRatingBadge(kpi.ratingGrade, true)}
                        <span class="evaluation-rating-text">${ratingMeta.label}</span>
                    </div>
                </div>
                <div class="evaluation-card evaluation-card-rating">
                    <span class="evaluation-card-label">Recommended Rating</span>
                    <div class="evaluation-rating-stack">
                        ${ratingComparison.hasRecommendation ? renderRatingBadge(ratingComparison.recommendedRating.grade, true) : '<span class="detail-rating-line">Waiting for Target and Actual values.</span>'}
                        <span class="evaluation-rating-text">${ratingComparison.hasRecommendation ? `${ratingComparison.recommendedRating.label} (${Math.round(ratingComparison.recommendedRating.achievement)}% of target)` : 'No calculated guide yet'}</span>
                    </div>
                </div>
                <div class="evaluation-card">
                    <span class="evaluation-card-label">Mid-Year Comment</span>
                    <p class="detail-comment-block">${escapeHtml(kpi.midYearComment || 'No mid-year comment yet.')}</p>
                </div>
                <div class="evaluation-card">
                    <span class="evaluation-card-label">Year-End Comment</span>
                    <p class="detail-comment-block">${escapeHtml(kpi.yearEndComment || 'No year-end comment yet.')}</p>
                </div>
                <div class="evaluation-card">
                    <span class="evaluation-card-label">Mismatch Justification</span>
                    <p class="detail-comment-block">${escapeHtml(
                        ratingComparison.hasMismatch
                            ? (kpi.ratingJustification || 'Justification not provided.')
                            : (kpi.ratingJustification || 'Not required because the final rating matches the guide.')
                    )}</p>
                </div>
                <div class="evaluation-card">
                    <span class="evaluation-card-label">Rating Criteria</span>
                    <div class="detail-rating-criteria">
                        ${ratingCriteriaGuide.map(line => `<span class="detail-rating-line">${escapeHtml(line)}</span>`).join('')}
                    </div>
                </div>
                <div class="evaluation-card evaluation-card-guide-status">
                    <span class="evaluation-card-label">Rating Guide Status</span>
                    <div class="detail-rating-scale">
                        <div class="rating-scale">
                            ${renderRatingScale(kpi.ratingGrade, ratingComparison.hasRecommendation ? ratingComparison.recommendedRating.grade : null)}
                        </div>
                    </div>
                    <div class="detail-rating-status ${ratingComparison.hasMismatch ? 'is-mismatch' : 'is-match'}">
                        ${ratingComparison.hasMismatch
                            ? 'Final rating does not match the rating guide. Please review justification before submitting.'
                            : 'Final rating matches the rating guide.'}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('detailContent').innerHTML = `
        <div class="detail-grid">
            <div class="detail-row">
                <span class="detail-label">KPI Name:</span>
                <span class="detail-value">${escapeHtml(kpi.name)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Owner:</span>
                <span class="detail-value">${escapeHtml(kpi.owner)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Team:</span>
                <span class="detail-value">${escapeHtml(kpi.team)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Department:</span>
                <span class="detail-value">${escapeHtml(kpi.department || '-')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value"><span class="badge badge-${status.toLowerCase().replace('-', '-')}">${status}</span></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Progress:</span>
                <span class="detail-value">${Math.round(progress)}%</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Target:</span>
                <span class="detail-value">${kpi.target} ${escapeHtml(kpi.unit)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Last Year Result:</span>
                <span class="detail-value">${kpi.lastYearResult ?? '-'} ${escapeHtml(kpi.unit)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Actual:</span>
                <span class="detail-value">${kpi.actual} ${escapeHtml(kpi.unit)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Start Date:</span>
                <span class="detail-value">${formatDisplayDate(kpi.startDate)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">End Date:</span>
                <span class="detail-value">${formatDisplayDate(kpi.endDate)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Remark:</span>
                <span class="detail-value">${escapeHtml(kpi.remark || '-')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Created:</span>
                <span class="detail-value">${formatDisplayDateTime(kpi.createdAt)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Updated:</span>
                <span class="detail-value">${formatDisplayDateTime(kpi.updatedAt)}</span>
            </div>
        </div>
        <div class="detail-progress-section">
            <h4>Progress Bar</h4>
            <div class="progress-bar detail-progress-bar">
                <div class="progress-fill" style="transform: scaleX(${Math.min(progress, 100) / 100}); background: ${getProgressColor(status)};"></div>
            </div>
        </div>
        ${evaluationSummary}
        ${smartDetails}
    `;

    const modal = document.getElementById('detailModal');
    openModalElement(modal);
}

function getSmartDetails(smart) {
    if (!smart) return '<span class="smart-score smart-score-empty">0/5</span>';

    const completedCount = [
        smart.specific,
        smart.measurable,
        smart.achievable,
        smart.relevant,
        smart.timeBound
    ].filter(value => value && value.trim()).length;

    return completedCount === 0
        ? '<span class="smart-score smart-score-empty">0/5</span>'
        : `<span class="smart-score">${completedCount}/5</span>`;
}

function getSmartTooltip(smart) {
    if (!smart) return 'No SMART criteria defined';

    const tooltip = [];

    if (smart.specific && smart.specific.trim()) {
        tooltip.push(`Specific:\n${smart.specific}`);
    }
    if (smart.measurable && smart.measurable.trim()) {
        tooltip.push(`Measurable:\n${smart.measurable}`);
    }
    if (smart.achievable && smart.achievable.trim()) {
        tooltip.push(`Achievable:\n${smart.achievable}`);
    }
    if (smart.relevant && smart.relevant.trim()) {
        tooltip.push(`Relevant:\n${smart.relevant}`);
    }
    if (smart.timeBound && smart.timeBound.trim()) {
        tooltip.push(`Time-bound:\n${smart.timeBound}`);
    }

    return tooltip.length === 0 ? 'No SMART criteria defined' : tooltip.join('\n\n');
}

// ==========================================
// END OF SCRIPT
// ========================================== 
