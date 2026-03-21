# Team KPI Tracking Dashboard

A modern, clean web application for tracking team KPIs and setting SMART goals. Built with vanilla HTML, CSS, and JavaScript, with Supabase used as the shared data store.

## 📁 Project Structure

```
demo/
├── index.html          # Main HTML file with all UI elements
├── style.css           # Modern clean styling
├── script.js           # JavaScript functionality and logic
└── README.md           # This file
```

## ✨ Features

### Dashboard
- **Summary Cards**: Quick overview of total, on-track, at-risk, off-track, and completed KPIs
- **Progress Overview**: Visual progress bars for all KPIs
- **Real-time Statistics**: Automatically updates as KPI data changes

### KPI Management
- **Add KPI**: Create new KPI records with complete information
- **Edit KPI**: Modify existing KPI data
- **Delete KPI**: Remove KPI records with confirmation
- **Auto-calculation**: Progress percentage calculated automatically

### SMART Criteria
- **Complete Fields**: Specific, Measurable, Achievable, Relevant, Time-bound
- **Validation**: Warning shown if any SMART field is empty
- **Status Badge**: Visual indicator showing SMART completion status

### KPI List & Filters
- **Search**: Find KPIs by name, owner, or team
- **Team Filter**: Filter by department/team
- **Status Filter**: Filter by completion status
- **Responsive Table**: Clean, modern table design
- **Action Buttons**: Quick edit and delete options

### Progress Tracking
- **Auto-calculation**: Progress % = (Actual / Target) × 100
- **Status Assignment**:
  - 🏆 **Completed**: Progress ≥ 100%
  - ✅ **On-track**: Progress 70-99%
  - ⚠️ **At-risk**: Progress 40-69%
  - ❌ **Off-track**: Progress < 40%

### Data Persistence
- **Supabase Data API**: All KPI data is stored in a Supabase Postgres table
- **Automatic Loading**: Data persists across browser sessions and devices
- **Sample Data**: 5 sample KPI records pre-loaded for testing

## 🎨 Design Highlights

- **Modern UI**: Clean, professional dashboard style
- **Soft Color Palette**: Blue, green, amber, and red status colors
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Card-based Layout**: Organized sections with shadows and spacing
- **Progress Bars**: Visual progress indicators with smooth animations
- **Hover Effects**: Subtle animations for better interactivity
- **Status Badges**: Color-coded status indicators
- **Clear Typography**: Excellent readability with proper hierarchy

## 🚀 How to Run

### Option 1: Using VS Code Live Server (Recommended)

1. **Open the folder in VS Code**
   ```bash
   # Navigate to your project folder
   cd demo
   
   # Open in VS Code
   code .
   ```

2. **Install Live Server Extension** (if not already installed)
   - Open VS Code Extensions (Ctrl+Shift+X)
   - Search for "Live Server"
   - Click "Install" next to the Live Server extension by Ritwick Dey

3. **Start Live Server**
   - Right-click on `index.html`
   - Select "Open with Live Server"
   - Your browser will automatically open the app

4. **Access the App**
   - The app will open at `http://127.0.0.1:5500` (or similar)
   - The page will auto-refresh when you make code changes

### Option 2: Using Python's Built-in Server

```bash
# Navigate to your project folder
cd demo

# For Python 3:
python -m http.server 8000

# For Python 2:
python -m SimpleHTTPServer 8000
```

Then open your browser and go to: `http://localhost:8000`

### Supabase Setup

Before opening the app, update the config block in `index.html` with your Supabase anon key:

```html
window.KPI_SUPABASE_CONFIG = {
    url: 'https://oovdrqxuhclpwrtayvgm.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
    table: 'kpis',
    seedSampleData: true
};
```

Create the table in Supabase SQL Editor:

```sql
create table if not exists public.kpis (
    id bigint primary key,
    name text not null,
    owner text not null,
    team text not null,
    department text,
    target numeric not null,
    last_year_result numeric,
    actual numeric not null default 0,
    unit text not null,
    start_date date not null,
    end_date date not null,
    rating_grade smallint not null default 3 check (rating_grade between 1 and 5),
    rating_criteria json not null default '{"rating2Min":70,"rating3Min":100,"rating4Min":110,"rating5Min":125}'::json,
    rating_justification text not null default '',
    midyear_comment text not null default '',
    yearend_comment text not null default '',
    remark text,
    smart json not null default '{}'::json,
    sort_order integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);
```

If your table already exists, run the migration in `migrations/2026-03-21-add-evaluation-fields.sql` or use the SQL below:

```sql
alter table if exists public.kpis
    alter column smart type json using smart::json;

alter table if exists public.kpis
    alter column smart set default '{}'::json;

alter table if exists public.kpis
    add column if not exists rating_grade smallint,
    add column if not exists rating_criteria json,
    add column if not exists rating_justification text,
    add column if not exists last_year_result numeric,
    add column if not exists midyear_comment text,
    add column if not exists yearend_comment text,
    add column if not exists created_at timestamptz,
    add column if not exists updated_at timestamptz;
```

If Row Level Security is enabled, add policies that allow the browser app to `select`, `insert`, `update`, and `delete` rows for the roles that will use it.

## 📝 KPI Fields

Each KPI record includes:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| KPI Name | Text | Yes | Name of the KPI |
| Owner | Text | Yes | Person responsible |
| Team | Text | Yes | Team/Department |
| Department | Text | No | Additional department info |
| Target | Number | Yes | Target value to achieve |
| Last Year Result | Number | No | Reference value from the previous year |
| Actual | Number | Yes | Current actual value |
| Unit | Text | Yes | Measurement unit (%, hours, USD, etc.) |
| Start Date | Date | Yes | KPI start date |
| End Date | Date | Yes | KPI end date |
| Rating Grade | Number | Yes | Final performance rating from 1 to 5 |
| Rating Criteria | JSON | Yes | User-adjustable performance thresholds for ratings 1 to 5 |
| Rating Justification | Text | No | Required when the final rating differs from the recommended guide |
| Mid-Year Comment | Text | No | Mid-year review notes and feedback |
| Year-End Comment | Text | No | Final review summary and recommendation |
| Remark | Text | No | Additional notes |
| Created At | Timestamp | Auto | When the record was created in Supabase |
| Updated At | Timestamp | Auto | When the record was last updated |

### SMART Criteria Fields

- **Specific**: Clearly define what needs to be achieved
- **Measurable**: Define how you'll measure success
- **Achievable**: Confirm the goal is realistically attainable
- **Relevant**: Explain why this goal is important
- **Time-bound**: Set clear deadlines

## 💾 Data Storage

All KPI data is stored in your Supabase project's `kpis` table through the REST Data API. This means:

- ✅ Data persists across browser sessions
- ✅ Data can be shared across devices and users
- ✅ The browser app keeps a small local backup for migration safety
- ⚠️ You must provide a valid Supabase anon key in `index.html`
- ⚠️ Your Supabase table and RLS policies must allow the required operations

## 🎯 Sample KPI Data

The app comes with 5 pre-loaded sample KPIs:

1. **Sales Revenue Growth** (Sales team)
   - Target: $1,000,000 | Actual: $750,000 | Progress: 75% (On-track)

2. **Customer Satisfaction Score** (Customer Service)
   - Target: 95% | Actual: 88% | Progress: 92.6% (On-track)

3. **Employee Training Hours** (HR)
   - Target: 80 hours | Actual: 45 hours | Progress: 56% (At-risk)

4. **Project Delivery On-Time** (Project Management)
   - Target: 100% | Actual: 95% | Progress: 95% (On-track)

5. **Cost Reduction Initiative** (Finance)
   - Target: $150,000 | Actual: $120,000 | Progress: 80% (On-track)

You can delete these and add your own KPIs anytime.

## 🔧 Customization

### Change Colors
Edit the CSS variables in style.css:

```css
:root {
    --primary-color: #4f46e5;      /* Main blue */
    --completed-color: #10b981;    /* Green */
    --on-track-color: #3b82f6;     /* Blue */
    --at-risk-color: #f59e0b;      /* Amber */
    --off-track-color: #ef4444;    /* Red */
}
```

### Modify Status Thresholds
Edit progress calculation in script.js:

```javascript
function getStatus(progress) {
    if (progress >= 100) return 'Completed';
    if (progress >= 70) return 'On-track';   // Change 70 to your value
    if (progress >= 40) return 'At-risk';    // Change 40 to your value
    return 'Off-track';
}
```

### Add Custom Fields
1. Add input fields to the form in index.html
2. Update the form submission function in script.js
3. Update the table to display new fields

## 🐛 Troubleshooting

### Data Not Saving?
- Check that `window.KPI_SUPABASE_CONFIG.anonKey` is set correctly in `index.html`
- Confirm the `kpis` table exists in Supabase
- If RLS is enabled, make sure `select`, `insert`, `update`, and `delete` policies allow access
- Check the browser console (F12) for Supabase API errors

### Live Server Not Working?
- Make sure Live Server extension is properly installed
- Try restarting VS Code
- Check that you're in the correct folder

### Form Not Submitting?
- Ensure all required fields (marked with *) are filled
- Check browser console (F12) for error messages
- Clear browser cache if strange behavior occurs

### Progress Bar Not Updating?
- Make sure you enter numbers for Target and Actual fields
- Check that both Target and Actual have valid values
- Refresh the page if needed

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Any modern browser with `fetch` support

## 🎓 Learning Points

This project demonstrates:

- **Vanilla JavaScript**: DOM manipulation, event handling
- **Supabase REST API**: Cloud-backed data persistence from the browser
- **CSS Grid & Flexbox**: Modern responsive layouts
- **Form Validation**: Client-side input validation
- **Data Filtering**: Search and filter algorithms
- **Progress Calculation**: Math-based KPI tracking
- **Modal Design**: Dialog boxes for forms
- **Responsive Design**: Mobile-first CSS approach

Perfect for beginners learning web development!

## 📝 Code Quality

- **Beginner-friendly**: Clear variable names and structure
- **Well-commented**: Important sections have explanations
- **Organized**: Logical function grouping and separation of concerns
- **No Dependencies**: Pure HTML, CSS, JavaScript
- **Easy to Modify**: Simple to add features or customize

## 🤝 Tips for Beginners

1. **Start with small changes**: Try modifying colors or text
2. **Use browser DevTools**: Press F12 to inspect elements
3. **Check console errors**: Press F12 → Console tab
4. **Test incrementally**: Refresh and test each change
5. **Read comments**: They explain the "why" behind code

## 📞 Help & Support

If you encounter issues:

1. Check the Troubleshooting section above
2. Check browser console (F12 → Console)
3. Ensure all files are in the same folder
4. Try clearing browser cache
5. Try opening in a different browser

## 📄 License

This is a beginner-friendly educational project - feel free to use and modify as needed!

---

**Enjoy tracking your team's KPIs! 🚀**
