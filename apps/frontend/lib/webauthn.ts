const textEncoder = new TextEncoder();

function encodeToBuffer(value: string): ArrayBuffer {
  return textEncoder.encode(value).buffer;
}

function toBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export type SerializedCredential = {
  id: string;
  rawId: string;
  type: string;
  response: {
    clientDataJSON: string;
    attestationObject?: string;
    transports?: AuthenticatorTransport[];
  };
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
};

type RegistrationOptions = {
  challenge: string;
  userHandle: string;
  userName: string;
  userDisplayName?: string;
};

export type SerializedAssertion = {
  id: string;
  rawId: string;
  type: string;
  response: {
    clientDataJSON: string;
    authenticatorData?: string;
    signature?: string;
    userHandle?: string | null;
  };
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
};

export async function createRegistrationCredential(options: RegistrationOptions): Promise<SerializedCredential> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.credentials?.create) {
    throw new Error('webauthn_not_supported');
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: encodeToBuffer(options.challenge),
    rp: {
      name: 'M46 Neural Console',
    },
    user: {
      id: encodeToBuffer(options.userHandle),
      name: options.userName,
      displayName: options.userDisplayName ?? options.userHandle,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 60_000,
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
    attestation: 'none',
  };

  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) {
    throw new Error('credential_creation_failed');
  }
  const response = credential.response as AuthenticatorAttestationResponse;

  const serialized: SerializedCredential = {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      attestationObject: response.attestationObject ? toBase64Url(response.attestationObject) : undefined,
      transports:
        typeof response.getTransports === 'function'
          ? ((response.getTransports() as AuthenticatorTransport[] | undefined) ?? undefined)
          : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };

  return serialized;
}

type AssertionOptions = {
  challenge: string;
};

export async function createAssertionCredential(options: AssertionOptions): Promise<SerializedAssertion> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.credentials?.get) {
    throw new Error('webauthn_not_supported');
  }

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: encodeToBuffer(options.challenge),
    timeout: 60_000,
    userVerification: 'preferred',
  };
  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error('credential_request_failed');
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: response.authenticatorData ? toBase64Url(response.authenticatorData) : undefined,
      signature: response.signature ? toBase64Url(response.signature) : undefined,
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}
