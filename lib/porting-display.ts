/**
 * User-facing porting message copy.
 * Vendor APIs still receive and store the original text; this only changes how we *display* it in Zing.
 */

/**
 * Rewrites common third-party sign-offs in port threads so the inbox reads like one Zing experience.
 * Skips hostnames (e.g. *.telnyx.com) so links stay valid.
 */
export function displayPortingMessageBody(raw: string): string {
  let s = raw
  s = s.replace(/\bTelnyx Porting Team\b/gi, "Porting team")
  s = s.replace(/\bTelnyx Admin\b/gi, "Porting team")
  s = s.replace(/\bTelnyx\s+Porting\b/gi, "Porting")
  s = s.replace(/\bfrom Telnyx\b/gi, "from the porting team")
  s = s.replace(/\bTelnyx\b/gi, (match, offset, str) => {
    const after = str.slice(offset + match.length, offset + match.length + 4)
    if (after.toLowerCase().startsWith(".com")) return match
    return "the porting team"
  })
  return s
}
