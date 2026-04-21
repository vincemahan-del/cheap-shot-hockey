// Cheap Shot Hockey — full SDLC quality pipeline
//
// Shows mabl as one of several quality tools in a real pipeline:
//   lint → unit tests + coverage → build → preview deploy →
//   mabl CSH-SMOKE-PR (Preview) → promote → mabl CSH-SMOKE-POSTDEPLOY (Prod)
//
// Plan architecture in mabl workspace:
//   CSH-SMOKE-PR           : labels type-smk,exec-pr,...   env=Preview only
//   CSH-SMOKE-POSTDEPLOY   : labels type-smk,exec-postdeploy,...  env=Prod only
// Single env per plan → one dispatch = one plan run. No fan-out.
//
// Required Jenkins credentials:
//   mabl-api-token       String     — mabl REST API token (Settings → APIs)
//
// Required environment variables (set in Jenkins global config):
//   MABL_WORKSPACE_ID    — mabl workspace UUID
//   MABL_APPLICATION_ID  — mabl application UUID
//   MABL_ENV_PREVIEW_ID  — mabl environment UUID for preview deploys
//   MABL_ENV_PROD_ID     — mabl environment UUID for production
//   PRODUCTION_URL       — e.g. https://cheap-shot-hockey.vercel.app
//
// How to demo it: see docs/DEMO-TICKET-TO-PROD.md

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '25'))
  }

  triggers {
    pollSCM('* * * * *')
  }

  environment {
    MABL_API_TOKEN = credentials('mabl-api-token')
    PATH           = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:${env.PATH}"
  }

  stages {

    stage('1. Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_COMMIT_SHORT = sh(
            script: "git rev-parse --short HEAD",
            returnStdout: true,
          ).trim()
          env.GIT_BRANCH_NAME = sh(
            script: "git rev-parse --abbrev-ref HEAD",
            returnStdout: true,
          ).trim()
          echo "Commit: ${env.GIT_COMMIT_SHORT} on ${env.GIT_BRANCH_NAME}"
        }
      }
    }

    stage('2. Install') {
      steps {
        sh 'node --version'
        sh 'npm ci'
      }
    }

    stage('3. Lint (eslint)') {
      steps {
        sh 'npm run lint'
      }
    }

    stage('4. Unit tests + coverage') {
      steps {
        sh 'npm run test:coverage'
      }
      post {
        always {
          // Publish the coverage HTML report so Jenkins links to it.
          archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true, fingerprint: true
        }
      }
    }

    stage('5. Build (Next.js)') {
      steps {
        sh 'npm run build'
      }
    }

    stage('6. Deploy preview (placeholder)') {
      when { not { branch 'main' } }
      steps {
        script {
          // Vercel auto-deploys branch pushes; this stage captures the URL.
          // Swap in `vercel --token $VERCEL_TOKEN --prebuilt` for real deploys.
          env.PREVIEW_URL = env.PRODUCTION_URL ?: "https://cheap-shot-hockey.vercel.app"
          echo "Preview URL: ${env.PREVIEW_URL}"
        }
      }
    }

    stage('7. mabl — CSH-SMOKE-PR (Preview, PR only)') {
      // Dispatches type-smk,exec-pr — targets plan CSH-SMOKE-PR in mabl
      // (Preview env only, API + UI stages). The split-plan design means
      // one dispatch can only fire one plan run — no fan-out possible.
      when { not { branch 'main' } }
      steps {
        sh """
          ./scripts/mabl-deployment.sh \\
            --environment $MABL_ENV_PREVIEW_ID \\
            --application $MABL_APPLICATION_ID \\
            --labels type-smk,exec-pr \\
            --url "${env.PREVIEW_URL ?: env.PRODUCTION_URL}" \\
            --commit "$GIT_COMMIT_SHORT" \\
            --branch "$GIT_BRANCH_NAME" \\
            --wait
        """
      }
    }

    // NOTE: mabl full regression is intentionally not wired yet.
    // Re-add a stage dispatching `type-rt,exec-nightly` against Prod once the
    // CSH-REGRESSION plan exists in mabl. Until then, dispatching that label
    // set wastes ~60s per main push with zero matching plans.

    stage('8. Promote to production') {
      when {
        allOf {
          branch 'main'
          expression { currentBuild.currentResult == 'SUCCESS' }
        }
      }
      steps {
        echo "Production promotion: Vercel is auto-deploying commit ${env.GIT_COMMIT_SHORT}."
      }
    }

    stage('9. mabl — CSH-SMOKE-POSTDEPLOY (Prod, main only)') {
      // Dispatches type-smk,exec-postdeploy — targets plan
      // CSH-SMOKE-POSTDEPLOY in mabl (Prod env only). Waits for Vercel
      // to reflect the new commit before firing so the smoke actually
      // validates the just-deployed code.
      when { branch 'main' }
      steps {
        script {
          def url = env.PRODUCTION_URL ?: "https://cheap-shot-hockey.vercel.app"
          sh """
            set -e
            for i in \$(seq 1 30); do
              live_sha=\$(curl -fsS $url/api/build-info | jq -r '.commit' | cut -c1-7)
              echo "live sha: \$live_sha vs expected ${env.GIT_COMMIT_SHORT}"
              if [ "\$live_sha" = "${env.GIT_COMMIT_SHORT}" ]; then
                echo "deploy reflects new commit"
                break
              fi
              sleep 10
            done
            curl -fsS $url/api/health | jq .
          """
          sh """
            ./scripts/mabl-deployment.sh \\
              --environment $MABL_ENV_PROD_ID \\
              --application $MABL_APPLICATION_ID \\
              --labels type-smk,exec-postdeploy \\
              --url "$url" \\
              --commit "$GIT_COMMIT_SHORT" \\
              --branch "main" \\
              --wait
          """
        }
      }
    }
  }

  post {
    failure {
      script {
        echo "❌ Pipeline failed at stage ${env.STAGE_NAME}."
        echo "If it was a mabl stage, the triage agent kicks in next:"
        sh './scripts/mabl-analyze-last-failure.sh || true'
      }
    }
    always {
      echo "Pipeline finished: ${currentBuild.currentResult}"
    }
  }
}
