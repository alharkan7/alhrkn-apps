"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pg_1 = require("pg");
var node_postgres_1 = require("drizzle-orm/node-postgres");
var schema = __importStar(require("./src/db/schema"));
var drizzle_orm_1 = require("drizzle-orm");
var nanoid_1 = require("nanoid");
var dotenv = __importStar(require("dotenv"));
dotenv.config({ path: '.env.local' });
var nanoid = (0, nanoid_1.customAlphabet)('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10);
var pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
var db = (0, node_postgres_1.drizzle)(pool, { schema: schema });
function migrate() {
    return __awaiter(this, void 0, void 0, function () {
        var events, migrated, skipped, _i, events_1, event_1, payload, keywords, language, userId, existing, id, e_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Starting migration of old outliner events to queries...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, 11, 12]);
                    return [4 /*yield*/, db
                            .select()
                            .from(schema.outlinerEvents)
                            .where((0, drizzle_orm_1.eq)(schema.outlinerEvents.action, 'stream'))
                            .orderBy((0, drizzle_orm_1.desc)(schema.outlinerEvents.createdAt))];
                case 2:
                    events = _a.sent();
                    console.log("Found ".concat(events.length, " stream events."));
                    migrated = 0;
                    skipped = 0;
                    _i = 0, events_1 = events;
                    _a.label = 3;
                case 3:
                    if (!(_i < events_1.length)) return [3 /*break*/, 9];
                    event_1 = events_1[_i];
                    if (!event_1.inputPayload)
                        return [3 /*break*/, 8];
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 7, , 8]);
                    payload = JSON.parse(event_1.inputPayload);
                    keywords = payload.keywords;
                    language = payload.language || 'en';
                    userId = event_1.userId;
                    if (!keywords)
                        return [3 /*break*/, 8];
                    return [4 /*yield*/, db
                            .select()
                            .from(schema.outlinerQueries)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.outlinerQueries.userId, userId), (0, drizzle_orm_1.eq)(schema.outlinerQueries.keywords, keywords)))
                            .limit(1)];
                case 5:
                    existing = _a.sent();
                    if (existing.length > 0) {
                        // Already migrated or created new
                        skipped++;
                        return [3 /*break*/, 8];
                    }
                    id = nanoid();
                    return [4 /*yield*/, db.insert(schema.outlinerQueries).values({
                            id: id,
                            userId: userId,
                            keywords: keywords,
                            language: language,
                            createdAt: event_1.createdAt,
                            updatedAt: event_1.createdAt,
                            ideas: [],
                        })];
                case 6:
                    _a.sent();
                    console.log("Migrated \"".concat(keywords, "\" for user ").concat(userId, " -> ID ").concat(id));
                    migrated++;
                    return [3 /*break*/, 8];
                case 7:
                    e_1 = _a.sent();
                    console.error('Error parsing event payload:', e_1);
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 3];
                case 9:
                    console.log("Migration complete. Migrated: ".concat(migrated, ", Skipped (duplicate): ").concat(skipped));
                    return [3 /*break*/, 12];
                case 10:
                    error_1 = _a.sent();
                    console.error('Migration failed:', error_1);
                    return [3 /*break*/, 12];
                case 11:
                    pool.end();
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
migrate();
