import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api, { ApiException } from '../../hooks/useApi';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import SidebandIcon from '../../components/icons/SidebandIcon';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';

export const InviteFlow: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useCurrentUser();

  const [isRedeeming, setIsRedeeming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (isAuthLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--canvas, #0B0D0E)',
        }}
      >
        <Spinner size={32} />
      </div>
    );
  }

  // Not authenticated: prompt user to authenticate first
  if (!isAuthenticated) {
    const redirectParam = encodeURIComponent(`/invite/${token}`);
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          backgroundColor: 'var(--canvas, #0B0D0E)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: 'var(--surface-1, #151A1C)',
            border: '1px solid var(--stroke, #303B3E)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '36px 32px',
            textAlign: 'center',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <SidebandIcon size={36} />
          </div>

          <h1
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--type, #E9ECE7)',
              letterSpacing: '-0.01em',
              marginBottom: '10px',
            }}
          >
            Workspace Invitation
          </h1>

          <p
            style={{
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--type-muted, #9FAAA6)',
              marginBottom: '28px',
            }}
          >
            You have received an invitation to join an Open Lite Discord workspace. Sign in or create an
            account on this instance to accept.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(`/auth?redirect=${redirectParam}`)}
            >
              Sign In to Accept
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate(`/auth?redirect=${redirectParam}`)}
            >
              Create New Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated: show redeem confirmation
  const handleRedeem = async () => {
    if (!token) return;

    setIsRedeeming(true);
    setErrorMessage(null);

    try {
      const res = await api.post<{ spaceId: string; spaceName?: string; alreadyMember?: boolean }>(
        '/api/v1/invites/redeem',
        { token }
      );

      await queryClient.invalidateQueries({ queryKey: ['spaces'] });
      navigate(`/app/spaces/${res.spaceId}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.code === 'INVITE_EXPIRED') {
          setErrorMessage('This invitation link has expired.');
        } else if (err.code === 'INVITE_EXHAUSTED') {
          setErrorMessage('This invitation link has reached its maximum allowed uses.');
        } else if (err.code === 'INVITE_REVOKED') {
          setErrorMessage('This invitation has been revoked by an administrator.');
        } else if (err.status === 404 || err.code === 'NOT_FOUND') {
          setErrorMessage('Invalid invitation token. Please request a new invite link.');
        } else {
          setErrorMessage(err.message || 'Failed to accept invitation.');
        }
      } else {
        setErrorMessage('Connection error. Please try again.');
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
        backgroundColor: 'var(--canvas, #0B0D0E)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--surface-1, #151A1C)',
          border: '1px solid var(--stroke, #303B3E)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '36px 32px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <SidebandIcon size={36} />
        </div>

        <h1
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--type, #E9ECE7)',
            letterSpacing: '-0.01em',
            marginBottom: '8px',
          }}
        >
          Accept Invitation
        </h1>

        <p
          style={{
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--type-muted, #9FAAA6)',
            marginBottom: '20px',
          }}
        >
          You are signed in as{' '}
          <strong style={{ color: 'var(--type, #E9ECE7)' }}>{user?.displayName}</strong> (@{user?.username}).
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(206, 128, 124, 0.12)',
              border: '1px solid rgba(206, 128, 124, 0.35)',
              borderRadius: 'var(--radius-md, 6px)',
              color: 'var(--danger, #CE807C)',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'left',
              lineHeight: 1.4,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button
            variant="primary"
            size="md"
            onClick={handleRedeem}
            isLoading={isRedeeming}
            style={{ width: '100%', height: '38px' }}
          >
            Accept & Enter Workspace
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={() => navigate('/app')}
            style={{ width: '100%' }}
          >
            Return to App
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InviteFlow;
