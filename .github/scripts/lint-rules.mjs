import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fs.realpathSync(path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')));
const errors = [];
const fail = (file, message) => errors.push(`${file}: ${message}`);
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

function walk(dir) {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
        const file = `${dir}/${entry.name}`;
        return entry.isDirectory() ? walk(file) : [file];
    });
}

const rules = ['app', 'resources', 'tests'].flatMap(walk).filter((file) => file.endsWith('/CLAUDE.md'));
const skills = walk('.agents/skills').filter((file) => file.endsWith('/SKILL.md'));
// Size budgets, in lines. The hub is read before every Filament edit, so it stays small:
// move a section into its class-type file and leave a pointer rather than raising the number.
const HUB = 'app/Filament/CLAUDE.md';
const HUB_MAX_LINES = 300;
const RULE_MAX_LINES = 850;
for (const file of [...rules, ...skills]) {
    const text = read(file);
    const lines = text.split('\n').length - 1;
    const budget = file === HUB ? HUB_MAX_LINES : RULE_MAX_LINES;
    if (rules.includes(file) && lines > budget) fail(file, `${lines} lines, over the ${budget}-line budget`);
    if (skills.includes(file) && /^```(?:php|blade)\b/m.test(text)) fail(file, 'skill must route to canonical code examples, not copy them');
    if ((text.match(/^```/gm)?.length ?? 0) % 2) fail(file, 'unclosed fenced block');
    for (const [, target] of text.matchAll(/`((?:app|resources|tests)\/[^`]+\/CLAUDE\.md)`/g)) {
        if (!exists(target)) fail(file, `missing rule pointer ${target}`);
    }
    const checks = [
        [/protected\s+static\s+\?string\s+\$navigation(?:Icon|Group)\b/, 'navigation types must match parent unions'],
        [/protected\s+static\s+\??string\s+\$pollingInterval\b/, 'widget pollingInterval is non-static'],
        [/protected\s+int\s+\$sort\b/, 'widget sort is static and nullable'],
        [/\bActionSize::/, 'use Filament\\Support\\Enums\\Size'],
        [/\bNotificationAction::/, 'use Filament\\Actions\\Action for notifications'],
        [/\bmake:filament-action\b/, 'no make:filament-action command exists'],
        [/\bgetTableEloquentQuery\s*\(/, 'use table modifyQueryUsing'],
        [/--resource=null\b/, 'null is interpreted as a resource name'],
        [/->scopedExists\(['"]id['"]/, 'scopedExists takes a model class first'],
        [/->authorize\(['"][^'"]+['"],\s*\$record\)/, 'record-bound authorize supplies the record automatically'],
        [/\bAction::cancel\(/, 'cancel is an instance method'],
        [/Filament\\Forms\\(?:Get|Set)\b/, 'Get and Set belong to Schemas Components Utilities'],
        [/afterStateUpdated\(fn \(string \$state/, 'cleared field state may be null'],
    ];
    for (const [pattern, message] of checks) if (pattern.test(text)) fail(file, message);
    if (['app/Filament/CLAUDE.md', 'app/Filament/Resources/Schemas/CLAUDE.md'].includes(file) && /Split::make|`Split`/.test(text.replace(/`Split` belongs to table column layout\./g, ''))) {
        fail(file, 'schema layouts use Flex, not Split');
    }
    if (/extends\s+(?:Page|Widget)\b/.test(text) && /protected\s+static\s+string\s+\$view\b/.test(text)) {
        fail(file, 'Page and Widget view properties are non-static');
    }
    for (const match of text.matchAll(/(?:TextColumn|TextEntry)::make\(['"][^'"]+_cents['"]\)([\s\S]*?)(?=\n\s*(?:TextColumn|TextEntry)::make|;|```|$)/g)) {
        if (/->money\(/.test(match[1]) && !/->money\([^)]*divideBy:\s*100\b/.test(match[1])) {
            fail(file, 'cents money example must divide by 100');
        }
    }
    for (const match of text.matchAll(/FileUpload::make\([\s\S]*?(?=\n\s*\w+::make\(|```|$)/g)) {
        if (!/->maxSize\(/.test(match[0])) fail(file, 'FileUpload example must specify maxSize');
    }
    for (const match of text.matchAll(/BulkAction::make\(['"]archive['"]\)[\s\S]*?(?=\n\s*BulkAction::make|```|$)/g)) {
        if (!/->authorizeIndividualRecords\(['"]archive['"]\)/.test(match[0])) fail(file, 'bulk archive must authorize individual records');
    }
}

const pathRules = fs.readdirSync(path.join(root, '.claude/rules')).filter((file) => file.endsWith('.md'));
for (const name of pathRules) {
    const file = `.claude/rules/${name}`;
    const full = path.join(root, file);
    if (!fs.lstatSync(full).isSymbolicLink()) fail(file, 'path rule must be a canonical-file symlink');
    if (!exists(file)) { fail(file, 'broken symlink'); continue; }
    const target = path.relative(root, fs.realpathSync(full));
    if (!rules.includes(target)) fail(file, 'target must be a canonical rule');
    if (!/^---\n[\s\S]*?\npaths:\n(?:  - .+\n)+---\n/.test(read(file))) fail(file, 'missing leading paths frontmatter');
    if (/^globs:/m.test(read(file))) fail(file, 'use paths, not globs');
}
for (const skill of skills) {
    const name = path.basename(path.dirname(skill));
    const file = `.claude/skills/${name}`;
    if (!exists(file) || !fs.lstatSync(path.join(root, file)).isSymbolicLink()) {
        fail(file, 'missing individual skill symlink');
    } else if (fs.realpathSync(path.join(root, file)) !== fs.realpathSync(path.join(root, path.dirname(skill)))) {
        fail(file, 'skill symlink points to wrong directory');
    }
}

// **/ matches zero or more directories; * matches one path segment.
function matches(pattern, file) {
    const expression = pattern.split('**/').map((part) => part.split('*').map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('(?:.*/)?');
    return new RegExp(`^${expression}$`).test(file);
}
const patterns = (file) => [...read(file).matchAll(/^  - (.+)$/gm)].map((match) => match[1]);
const coverage = [
    ['Resources/Schemas', 'app/Filament/Resources/Orders/Schemas/OrderForm.php'],
    ['Resources/Schemas', 'app/Filament/Admin/Resources/Orders/Schemas/Components/OrderNameInput.php'],
    ['Resources/Tables', 'app/Filament/Resources/Orders/Tables/OrdersTable.php'],
    ['Resources/Tables', 'app/Filament/Admin/Clusters/Commerce/Resources/Orders/Tables/Columns/OrderTotalColumn.php'],
    ['Resources/Tables', 'app/Filament/Resources/Orders/Tables/Filters/OrderStatusFilter.php'],
    ['Resources/Pages', 'app/Filament/Resources/Orders/Pages/ListOrders.php'],
    ['Resources/Pages', 'app/Filament/Admin/Clusters/Commerce/Resources/Orders/Pages/EditOrder.php'],
    ['Resources/RelationManagers', 'app/Filament/Resources/Orders/RelationManagers/ItemsRelationManager.php'],
    ['Resources', 'app/Filament/Admin/Clusters/Commerce/Resources/Orders/OrderResource.php'],
];
for (const [kind, target] of coverage) {
    const file = `app/Filament/${kind}/CLAUDE.md`;
    if (!patterns(file).some((pattern) => matches(pattern, target))) fail(file, `path patterns miss ${target}`);
}
const resourcePages = 'app/Filament/Resources/Pages/CLAUDE.md';
for (const page of ['app/Filament/Pages/Settings.php', 'app/Filament/Admin/Pages/Dashboard.php', 'app/Filament/Clusters/Commerce/Pages/Report.php']) {
    if (patterns(resourcePages).some((pattern) => matches(pattern, page))) fail(resourcePages, `resource-page pattern matches standalone ${page}`);
}
const hub = read('app/Filament/CLAUDE.md');
for (const rule of rules.filter((file) => file !== 'app/Filament/CLAUDE.md')) {
    if (!hub.includes(rule)) fail('app/Filament/CLAUDE.md', `missing routing pointer ${rule}`);
}
if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
console.log(`Rules lint passed: ${rules.length} canonical rules, ${pathRules.length} path rules, ${skills.length} skills; declarations, money examples, uploads, links, and routing checked.`);
