/**
 * certificateUtils.ts
 * Handles capturing the certificate view as an image,
 * saving to device gallery, and sharing via share sheet.
 * 
 * Dependencies (must be installed):
 *   - react-native-view-shot
 *   - expo-media-library
 *   - expo-sharing
 */

import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaptureResult {
  uri: string;
}

export interface SaveResult {
  success: boolean;
  message?: string;
  error?: string;
  usedShareFallback?: boolean;
}

// ─── Step 1: Capture View as PNG ─────────────────────────────────────────────

/**
 * Captures a react-native-view-shot ref as a high-resolution PNG.
 * 
 * HOW TO USE:
 *   1. Import ViewShot from 'react-native-view-shot'
 *   2. Wrap your CertificateView in <ViewShot ref={certificateRef} ...>
 *   3. Call captureCertificateRef(certificateRef)
 * 
 * @param ref - A React ref created by useRef(null) attached to a ViewShot component
 * @returns Promise<string> - The local file URI of the captured PNG
 */
export async function captureCertificateRef(ref: React.RefObject<any>): Promise<string> {
  if (!ref.current) {
    throw new Error('Certificate ref is not attached to a component');
  }

  try {
    // Wait 600ms for the view to fully paint before capturing
    await new Promise<void>((resolve) => setTimeout(resolve, 600));

    // capture() is the ViewShot instance method
    const uri: string = await ref.current.capture({
      format: 'png',
      quality: 1.0,
      result: 'tmpfile',
      snapshotContentContainer: false,
    });
    return uri;
  } catch (error) {
    console.error('captureCertificateRef failed:', error);
    throw new Error('Could not capture certificate image');
  }
}

// ─── Step 2: Save to Device Gallery ──────────────────────────────────────────

const ALBUM_NAME = 'Gastos';

/**
 * Saves a captured image URI to the device photo gallery.
 * Requests MediaLibrary permission first.
 * Falls back to share sheet if permission is denied.
 * 
 * @param capturedUri - The local file URI returned by captureCertificateRef()
 * @returns SaveResult - { success, message, error, usedShareFallback }
 */
export async function saveCertificateToDevice(capturedUri: string): Promise<SaveResult> {
  try {
    // Request media library permission
    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status !== 'granted') {
      // Permission denied — fall back to share sheet
      try {
        await shareCertificate(capturedUri);
        return {
          success: true,
          usedShareFallback: true,
          message: 'Certificate shared via share sheet',
        };
      } catch (shareError) {
        return {
          success: false,
          error: 'Storage permission denied and sharing failed',
        };
      }
    }

    // Create an asset in the photo library
    const asset = await MediaLibrary.createAssetAsync(capturedUri);

    // Save to a named album (creates if not exists)
    const existingAlbum = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
    if (existingAlbum === null) {
      await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
    }

    return {
      success: true,
      message: 'Certificate saved to your gallery!',
    };
  } catch (error) {
    console.error('saveCertificateToDevice failed:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ─── Step 3: Share via Share Sheet ───────────────────────────────────────────

/**
 * Opens the native share sheet with the certificate image.
 * Used as a fallback when gallery save fails or permission is denied.
 * 
 * @param capturedUri - The local file URI of the captured PNG
 */
export async function shareCertificate(capturedUri: string): Promise<void> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(capturedUri, {
      mimeType: 'image/png',
      dialogTitle: 'Share your Financial Certificate',
      UTI: 'image/png',
    });
  } catch (error) {
    console.error('shareCertificate failed:', error);
    throw error;
  }
}

// ─── Combined Download Flow ───────────────────────────────────────────────────

/**
 * Full download flow: capture → save to gallery → fallback to share.
 * 
 * @param ref - ViewShot ref attached to the CertificateView
 * @returns SaveResult
 */
export async function downloadCertificate(ref: React.RefObject<any>): Promise<SaveResult> {
  // Capture the view
  const uri = await captureCertificateRef(ref);

  // Try saving to device gallery (handles fallback internally)
  return saveCertificateToDevice(uri);
}
