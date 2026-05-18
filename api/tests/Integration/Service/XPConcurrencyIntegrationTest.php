<?php

declare(strict_types=1);

namespace Tests\Integration\Service;

use App\Entity\User;
use App\Entity\UserXpEvent;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

class XPConcurrencyIntegrationTest extends KernelTestCase
{
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        restore_exception_handler();
    }

    public function testParallelRegisterCommandCreatesOnlyOneDeduplicatedEvent(): void
    {
        /** @var User|null $user */
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        $this->assertNotNull($user, 'Fixture user user6@example.com not found. Run "bin/console doctrine:fixtures:load --group=test".');
        $userId = (int) $user->getId();
        $actionType = 'calendar_event';
        $actionId = random_int(700000000, 799999999);

        $this->deleteXpEvents($userId, $actionType, $actionId);

        $singleCommand = $this->buildRegisterWorkerCommand($userId, $actionType, $actionId);

        $this->runParallelCommands($singleCommand, 30);

        $count = $this->countXpEvents($userId, $actionType, $actionId);
        $this->assertSame(1, $count, 'Exactly one XP event must be stored for deduplicated action under parallel load.');

        $this->deleteXpEvents($userId, $actionType, $actionId);
    }

    private function runParallelCommands(string $singleCommand, int $parallelCalls): void
    {
        $script = sprintf(
            'set -e; status=0; pids=""; for i in $(seq 1 %d); do (%s) & pids="$pids $!"; done; for p in $pids; do wait "$p" || status=1; done; exit $status',
            $parallelCalls,
            $singleCommand
        );

        [$exitCode, $stdout, $stderr] = $this->runShellScript($script);
        $this->assertSame(
            0,
            $exitCode,
            "Parallel command execution failed.\nSTDOUT:\n{$stdout}\nSTDERR:\n{$stderr}"
        );
    }

    private function buildRegisterWorkerCommand(int $userId, string $actionType, int $actionId): string
    {
        $workerScript = <<<'PHP'
require __DIR__ . '/vendor/autoload.php';
$kernel = new \App\Kernel('test', true);
$kernel->boot();

$container = $kernel->getContainer();
$em = $container->get('doctrine')->getManager();
$user = $em->getRepository(\App\Entity\User::class)->find((int) getenv('XP_USER_ID'));

if (null === $user) {
    fwrite(STDERR, 'worker user not found');
    exit(2);
}

$service = new \App\Service\XPRegistrationService($em, $em->getRepository(\App\Entity\XpRule::class));
$service->registerXpEvent($user, (string) getenv('XP_ACTION_TYPE'), (int) getenv('XP_ACTION_ID'));
$kernel->shutdown();
PHP;

        return sprintf(
            'APP_ENV=test XP_USER_ID=%d XP_ACTION_TYPE=%s XP_ACTION_ID=%d php -r %s',
            $userId,
            escapeshellarg($actionType),
            $actionId,
            escapeshellarg($workerScript)
        );
    }

    /**
     * @return array{0:int,1:string,2:string}
     */
    private function runShellScript(string $script): array
    {
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open(
            ['bash', '-lc', $script],
            $descriptors,
            $pipes,
            $this->projectApiPath()
        );

        if (!\is_resource($process)) {
            $this->fail('Could not start shell process for parallel command execution.');
        }

        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]) ?: '';
        fclose($pipes[1]);
        $stderr = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[2]);
        $exitCode = proc_close($process);

        return [$exitCode, $stdout, $stderr];
    }

    private function countXpEvents(int $userId, string $actionType, int $actionId): int
    {
        return (int) $this->em->createQueryBuilder()
            ->select('COUNT(e.id)')
            ->from(UserXpEvent::class, 'e')
            ->where('IDENTITY(e.user) = :uid')
            ->andWhere('e.actionType = :actionType')
            ->andWhere('e.actionId = :actionId')
            ->setParameter('uid', $userId)
            ->setParameter('actionType', $actionType)
            ->setParameter('actionId', $actionId)
            ->getQuery()
            ->getSingleScalarResult();
    }

    private function deleteXpEvents(int $userId, string $actionType, int $actionId): void
    {
        $this->em->createQueryBuilder()
            ->delete(UserXpEvent::class, 'e')
            ->where('IDENTITY(e.user) = :uid')
            ->andWhere('e.actionType = :actionType')
            ->andWhere('e.actionId = :actionId')
            ->setParameter('uid', $userId)
            ->setParameter('actionType', $actionType)
            ->setParameter('actionId', $actionId)
            ->getQuery()
            ->execute();
    }

    private function projectApiPath(): string
    {
        return dirname(__DIR__, 3);
    }
}
