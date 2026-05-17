import './SplashScreen.css';

export default function SplashScreen({ tagline = 'BEAUTÉ SÉNÉGAL' }) {
  return (
    <div className="yspl-screen">
      <div className="yspl-logo-wrap">
        <div className="yspl-logo-text">
          YARAM
          <span className="yspl-logo-dot" />
        </div>
        <div className="yspl-tagline">{tagline}</div>
      </div>
      <div className="yspl-loader">
        <div className="yspl-loader-dot" />
        <div className="yspl-loader-dot" />
        <div className="yspl-loader-dot" />
      </div>
    </div>
  );
}
