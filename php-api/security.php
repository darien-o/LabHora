<?php
/**
 * security.php — Request-level security middleware.
 *
 * Include this after db.php in every endpoint:
 *   require_once __DIR__ . '/security.php';
 *   apply_security_checks();
 *
 * Enforces:
 *   1. Body size limit (64 KB) — reject before parsing
 *   2. Rate limiting (60 req/min per hashed IP per endpoint)
 *   3. Logs all rejected requests to PHP error_log (never exposes reason to client)
 */

declare(strict_types=1);

/**
 * Run all security checks for the current request.
 * Call this once at the top of each endpoint, after cors_headers().
 *
 * @param int $maxBodyBytes   Maximum request body size in bytes (default: 64 KB)
 * @param int $rateLimit      Maximum requests per window (default: 60)
 * @param int $windowSeconds  Rate limit window in seconds (default: 60)
 */
function apply_security_checks(
    int $maxBodyBytes  = 65536,
    int $rateLimit     = 60,
    int $windowSeconds = 60
): void {
    _check_body_size($maxBodyBytes);
    _check_rate_limit($rateLimit, $windowSeconds);
}

// ── Body size check ───────────────────────────────────────────────────────────

function _check_body_size(int $maxBytes): void
{
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
    if ($contentLength > $maxBytes) {
        error_log(sprintf(
            '[security] Body too large: %d bytes from %s on %s',
            $contentLength,
            _hashed_ip(),
            _endpoint_name()
        ));
        http_response_code(413);
        echo json_encode(['error' => 'Solicitud demasiado grande.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

function _check_rate_limit(int $limit, int $windowSeconds): void
{
    $ipHash   = _hashed_ip();
    $endpoint = _endpoint_name();

    try {
        $pdo = get_pdo();
        $now = new DateTime('now', new DateTimeZone('UTC'));

        // Try to fetch existing window record
        $stmt = $pdo->prepare(
            'SELECT id, request_count, window_start FROM rate_limits
             WHERE ip_hash = ? AND endpoint = ?
             LIMIT 1'
        );
        $stmt->execute([$ipHash, $endpoint]);
        $row = $stmt->fetch();

        if ($row === false) {
            // First request from this IP on this endpoint
            $ins = $pdo->prepare(
                'INSERT INTO rate_limits (ip_hash, endpoint, request_count, window_start)
                 VALUES (?, ?, 1, ?)'
            );
            $ins->execute([$ipHash, $endpoint, $now->format('Y-m-d H:i:s')]);
            return;
        }

        $windowStart  = new DateTime($row['window_start'], new DateTimeZone('UTC'));
        $elapsed      = $now->getTimestamp() - $windowStart->getTimestamp();

        if ($elapsed >= $windowSeconds) {
            // Window expired — reset
            $upd = $pdo->prepare(
                'UPDATE rate_limits SET request_count = 1, window_start = ? WHERE id = ?'
            );
            $upd->execute([$now->format('Y-m-d H:i:s'), $row['id']]);
            return;
        }

        if ((int)$row['request_count'] >= $limit) {
            error_log(sprintf(
                '[security] Rate limit hit: %d requests in %ds from %s on %s',
                $row['request_count'],
                $elapsed,
                $ipHash,
                $endpoint
            ));
            http_response_code(429);
            header('Retry-After: ' . ($windowSeconds - $elapsed));
            echo json_encode(
                ['error' => 'Demasiadas solicitudes. Intenta de nuevo en un momento.'],
                JSON_UNESCAPED_UNICODE
            );
            exit;
        }

        // Increment counter within current window
        $upd = $pdo->prepare(
            'UPDATE rate_limits SET request_count = request_count + 1 WHERE id = ?'
        );
        $upd->execute([$row['id']]);

    } catch (PDOException $e) {
        // Rate limiting failure must NEVER block legitimate requests
        error_log('[security] Rate limit DB error (non-fatal): ' . $e->getMessage());
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return SHA-256 hash of the client IP. Never stores the raw IP. */
function _hashed_ip(): string
{
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['HTTP_X_REAL_IP']
        ?? $_SERVER['REMOTE_ADDR']
        ?? 'unknown';
    // Take only the first IP if X-Forwarded-For has a chain
    $ip = trim(explode(',', $ip)[0]);
    return hash('sha256', $ip);
}

/** Return the current script's basename as the endpoint identifier. */
function _endpoint_name(): string
{
    return basename($_SERVER['SCRIPT_NAME'] ?? 'unknown');
}
