// System volume: stepping/mute via media-key SendKeys, absolute get/set via Core Audio COM.
import { runPS } from "./ps.js";

// SendKeys media char codes: 173 mute, 174 vol-, 175 vol+, 179 play/pause.
// Fast (COM, no compile) and reliable for volume + play/pause.
async function sendMediaKey(code, times = 1) {
  const line = `$w = New-Object -ComObject WScript.Shell; ` +
    `1..${times} | ForEach-Object { $w.SendKeys([char]${code}) }`;
  await runPS(line);
}

// keybd_event virtual-key injection — the reliable path for next/prev track,
// which SendKeys char codes deliver inconsistently. VK: 0xB0 next, 0xB1 prev.
async function sendVK(vk) {
  const script =
    `Add-Type -Name K -Namespace N -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, System.IntPtr e);'; ` +
    `[N.K]::keybd_event(${vk},0,0,[System.IntPtr]::Zero); [N.K]::keybd_event(${vk},0,2,[System.IntPtr]::Zero)`;
  await runPS(script);
}

export async function volumeUp(steps = 1) {
  await sendMediaKey(175, steps);
}
export async function volumeDown(steps = 1) {
  await sendMediaKey(174, steps);
}
export async function toggleMute() {
  await sendMediaKey(173, 1);
}
export async function mediaPlayPause() {
  await sendMediaKey(179, 1);
}
export async function mediaNext() {
  await sendVK(0xb0);
}
export async function mediaPrev() {
  await sendVK(0xb1);
}

// Core Audio C# snippet for absolute master volume get/set (0-100) and mute state.
const COREAUDIO = `
Add-Type -Language CSharp @"
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float level, Guid ctx);
  int j();
  int GetMasterVolumeLevelScalar(out float level);
  int k(); int l();
  int SetMute(bool mute, Guid ctx);
  int GetMute(out bool mute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ep); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static IAudioEndpointVolume Vol() {
    var e = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
    IMMDevice dev; e.GetDefaultAudioEndpoint(0, 1, out dev);
    var iid = typeof(IAudioEndpointVolume).GUID; object o;
    dev.Activate(ref iid, 23, IntPtr.Zero, out o);
    return (IAudioEndpointVolume)o;
  }
  public static float Get() { float v; Vol().GetMasterVolumeLevelScalar(out v); return v; }
  public static void Set(float v) { Vol().SetMasterVolumeLevelScalar(v, Guid.Empty); }
  public static bool Muted() { bool m; Vol().GetMute(out m); return m; }
}
"@
`;

export async function getVolume() {
  const out = await runPS(COREAUDIO + `[math]::Round([Audio]::Get() * 100)`);
  const n = parseInt(out, 10);
  return Number.isFinite(n) ? n : null;
}

export async function isMuted() {
  const out = await runPS(COREAUDIO + `[Audio]::Muted()`);
  return /true/i.test(out);
}

export async function setVolume(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  await runPS(COREAUDIO + `[Audio]::Set(${clamped / 100})`);
  return clamped;
}
